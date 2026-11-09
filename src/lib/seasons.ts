/**
 * Real seasons and episodes (server side).
 *
 * The bundled catalogue only carries a season *count*, and the live catalogue
 * carries nothing at all — so the UI used to show a single season of invented
 * episode titles for every show. This module asks TMDB for the actual thing:
 * every season a show has, and every episode inside it, with the real name,
 * runtime, air date, synopsis and still.
 *
 * Two layers of caching keep it cheap:
 *   • a per-instance map (instant on a warm lambda),
 *   • `next: { revalidate }` on each fetch, so Vercel's data cache holds the
 *     payload for six hours and a cold start does not re-ask TMDB.
 *
 * Server-only: it reads a credential. Never import it from a client component.
 */

import { TMDB_API_KEY, isBearerToken } from "@/lib/tmdb-key";
import type { Episode, Season } from "@/lib/types";

const ENDPOINT = "https://api.themoviedb.org/3";
const STILL = "https://image.tmdb.org/t/p/w300";
const TTL = 6 * 60 * 60 * 1000;

/** How many seasons we are willing to expand in one page render. */
const MAX_SEASONS = 40;
/** How many episodes per season we keep (no show needs more). */
const MAX_EPISODES = 120;
/** Parallel season requests — TMDB rate limits are per second, not per call. */
const LANES = 6;

const key = () =>
  (process.env.TMDB_API_KEY ?? process.env.NEXT_PUBLIC_TMDB_API_KEY ?? TMDB_API_KEY ?? "").trim();

export const hasSeasonsKey = () => Boolean(key());

type Cached<T> = { value: T; at: number };

const seasonCache = new Map<number, Cached<Season[]>>();
const infoCache = new Map<number, Cached<SeriesInfo | null>>();

async function tmdb<T>(path: string, revalidate = 21_600): Promise<T | null> {
  const token = key();
  if (!token) return null;

  const url = `${ENDPOINT}${path}`;
  const headers: Record<string, string> = { accept: "application/json" };
  const request = isBearerToken(token)
    ? { url, headers: { ...headers, authorization: `Bearer ${token}` } }
    : {
        url: `${url}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(token)}`,
        headers,
      };

  try {
    const res = await fetch(request.url, {
      headers: request.headers,
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Everything a series page needs to look real instead of generated. */
export type SeriesInfo = {
  tmdbId: number;
  name: string;
  overview?: string;
  tagline?: string;
  year?: number;
  rating?: number;
  maturity?: string;
  runtime?: number;
  seasons: number;
  episodes: number;
  poster?: string;
  backdrop?: string;
  genres: string[];
  status?: string;
  /** "(2024)" style air span, for the meta line */
  airSpan?: string;
};

const TV_GENRES: Record<number, string> = {
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  10759: "Action",
  9648: "Mystery",
  10765: "Sci-Fi",
  10768: "War",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10766: "Soap",
  10767: "Talk",
  10769: "Foreign",
  37: "Western",
};

const maturityOf = (rating: boolean | undefined, adult: boolean | undefined) =>
  adult ? "18+" : rating ? "TV-MA" : "TV-14";

type RawShow = {
  id: number;
  name?: string;
  overview?: string;
  tagline?: string;
  first_air_date?: string;
  last_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: { id: number; name: string }[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  status?: string;
  adult?: boolean;
  seasons?: RawSeasonSummary[];
};

type RawSeasonSummary = {
  season_number?: number;
  name?: string;
  air_date?: string | null;
  episode_count?: number;
  poster_path?: string | null;
};

type RawEpisode = {
  episode_number?: number;
  name?: string;
  runtime?: number | null;
  overview?: string;
  air_date?: string | null;
  still_path?: string | null;
};

type RawSeasonDetail = { episodes?: RawEpisode[] };

const yearOf = (date?: string | null) => Number((date ?? "").slice(0, 4)) || undefined;

/** The show's own metadata, cached. */
export async function seriesInfo(tmdbId: number): Promise<SeriesInfo | null> {
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return null;

  const hit = infoCache.get(tmdbId);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const raw = await tmdb<RawShow>(`/tv/${tmdbId}`);
  if (!raw) {
    infoCache.set(tmdbId, { value: null, at: Date.now() });
    return null;
  }

  const first = yearOf(raw.first_air_date);
  const last = yearOf(raw.last_air_date);
  const info: SeriesInfo = {
    tmdbId,
    name: raw.name ?? `Series ${tmdbId}`,
    overview: raw.overview || undefined,
    tagline: raw.tagline || undefined,
    year: first,
    rating: raw.vote_average ? Math.round(raw.vote_average * 10) / 10 : undefined,
    maturity: maturityOf(undefined, raw.adult),
    runtime: raw.episode_run_time?.[0] ?? 45,
    seasons: raw.number_of_seasons ?? raw.seasons?.length ?? 1,
    episodes: raw.number_of_episodes ?? 0,
    poster: raw.poster_path ? `https://image.tmdb.org/t/p/w500${raw.poster_path}` : undefined,
    backdrop: raw.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${raw.backdrop_path}`
      : undefined,
    genres: (raw.genres ?? []).map((g) => g.name).length
      ? (raw.genres ?? []).map((g) => g.name)
      : [],
    status: raw.status || undefined,
    airSpan:
      first && last && last !== first ? `${first}–${last}` : first ? `${first}` : undefined,
  };

  /* genre ids → our display names when TMDB hands back ids only */
  if (!info.genres.length) {
    const ids = (raw as RawShow & { genre_ids?: number[] }).genre_ids ?? [];
    info.genres = ids.map((id) => TV_GENRES[id]).filter(Boolean) as string[];
  }

  infoCache.set(tmdbId, { value: info, at: Date.now() });
  return info;
}

async function seasonDetail(tmdbId: number, seasonNumber: number): Promise<RawEpisode[]> {
  const raw = await tmdb<RawSeasonDetail>(`/tv/${tmdbId}/season/${seasonNumber}`);
  return raw?.episodes ?? [];
}

const MOVIE_GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

type RawMovie = {
  id: number;
  title?: string;
  overview?: string;
  tagline?: string;
  release_date?: string;
  runtime?: number;
  vote_average?: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: { id: number; name: string }[];
  adult?: boolean;
  status?: string;
};

export type MovieInfo = {
  tmdbId: number;
  name: string;
  overview?: string;
  tagline?: string;
  year?: number;
  rating?: number;
  runtime?: number;
  poster?: string;
  backdrop?: string;
  genres: string[];
  maturity: string;
};

const movieCache = new Map<number, Cached<MovieInfo | null>>();

/** Film metadata, so a live-catalogue film does not open on placeholder copy. */
export async function movieInfo(tmdbId: number): Promise<MovieInfo | null> {
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return null;

  const hit = movieCache.get(tmdbId);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const raw = await tmdb<RawMovie>(`/movie/${tmdbId}`);
  if (!raw) {
    movieCache.set(tmdbId, { value: null, at: Date.now() });
    return null;
  }

  const info: MovieInfo = {
    tmdbId,
    name: raw.title ?? `Film ${tmdbId}`,
    overview: raw.overview || undefined,
    tagline: raw.tagline || undefined,
    year: yearOf(raw.release_date),
    rating: raw.vote_average ? Math.round(raw.vote_average * 10) / 10 : undefined,
    runtime: raw.runtime || undefined,
    poster: raw.poster_path ? `https://image.tmdb.org/t/p/w500${raw.poster_path}` : undefined,
    backdrop: raw.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${raw.backdrop_path}`
      : undefined,
    genres: (raw.genres ?? []).map((g) => g.name),
    maturity: raw.adult ? "18+" : "16+",
  };

  movieCache.set(tmdbId, { value: info, at: Date.now() });
  return info;
}

/**
 * Every season of a show, in order, with its real episodes.
 *
 * `season_number: 0` is TMDB's bucket for specials — we leave it out, it is not
 * part of the watch order. If TMDB cannot be reached the caller keeps whatever
 * fallback it had, so the page still works offline.
 */
export async function realSeasons(tmdbId: number): Promise<Season[]> {
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return [];

  const hit = seasonCache.get(tmdbId);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const show = await tmdb<RawShow>(`/tv/${tmdbId}`);
  if (!show) return [];

  const summaries = (show.seasons ?? [])
    .filter((entry) => (entry.season_number ?? 0) > 0)
    .slice(0, MAX_SEASONS);

  const numbers = summaries.length
    ? summaries.map((entry) => entry.season_number as number)
    : Array.from({ length: Math.min(show.number_of_seasons ?? 1, MAX_SEASONS) }, (_, i) => i + 1);

  /* walk the seasons a few at a time instead of firing 20 requests at once */
  const episodesBySeason = new Map<number, RawEpisode[]>();
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(LANES, numbers.length) }, async () => {
      while (cursor < numbers.length) {
        const index = cursor++;
        const number = numbers[index];
        episodesBySeason.set(number, await seasonDetail(tmdbId, number));
      }
    }),
  );

  const seasons: Season[] = numbers.map((number) => {
    const summary = summaries.find((entry) => entry.season_number === number);
    const raw = (episodesBySeason.get(number) ?? []).slice(0, MAX_EPISODES);

    const episodes: Episode[] = raw.map((entry, index) => ({
      number: entry.episode_number ?? index + 1,
      name: entry.name?.trim() || `Episode ${entry.episode_number ?? index + 1}`,
      runtime: entry.runtime ?? show.episode_run_time?.[0] ?? 45,
      overview: entry.overview || "",
      still: entry.still_path ? `${STILL}${entry.still_path}` : undefined,
      airDate: entry.air_date || undefined,
    }));

    /* a season TMDB lists but has not expanded yet (announced, unaired) */
    if (!episodes.length && (summary?.episode_count ?? 0) > 0) {
      for (let i = 0; i < Math.min(summary?.episode_count ?? 0, MAX_EPISODES); i++) {
        episodes.push({
          number: i + 1,
          name: `Episode ${i + 1}`,
          runtime: show.episode_run_time?.[0] ?? 45,
          overview: "",
        });
      }
    }

    return {
      number,
      year: yearOf(summary?.air_date) ?? yearOf(show.first_air_date) ?? new Date().getFullYear(),
      name: summary?.name || `Season ${number}`,
      episodes,
    };
  });

  /* a show with no episodes at all is useless to the player */
  const usable = seasons.filter((season) => season.episodes.length > 0);
  const value = usable.length ? usable : seasons;

  seasonCache.set(tmdbId, { value, at: Date.now() });
  return value;
}

/* ------------------------------------------------------------------ anime */

const ANILIST = "https://graphql.anilist.co";
const JIKAN = "https://api.jikan.moe/v4";

export type AnimeInfo = {
  anilistId?: number;
  malId?: number;
  name: string;
  overview?: string;
  year?: number;
  rating?: number;
  episodes: number;
  runtime: number;
  poster?: string;
  backdrop?: string;
  genres: string[];
  format?: string;
  status?: string;
};

const animeInfoCache = new Map<string, Cached<AnimeInfo | null>>();
const animeSeasonCache = new Map<string, Cached<Season[]>>();

const ANILIST_QUERY = `query ($id: Int, $mal: Int) {
  Media(id: $id, idMal: $mal, type: ANIME) {
    id
    idMal
    title { romaji english }
    description(asHtml: false)
    seasonYear
    averageScore
    episodes
    duration
    format
    status
    genres
    coverImage { extraLarge large }
    bannerImage
  }
}`;

type AniListMedia = {
  id: number;
  idMal: number | null;
  title?: { romaji?: string; english?: string };
  description?: string;
  seasonYear?: number;
  averageScore?: number;
  episodes?: number | null;
  duration?: number | null;
  format?: string;
  status?: string;
  genres?: string[];
  coverImage?: { extraLarge?: string; large?: string };
  bannerImage?: string;
};

async function anilist(variables: { id?: number; mal?: number }): Promise<AniListMedia | null> {
  try {
    const res = await fetch(ANILIST, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: ANILIST_QUERY, variables }),
      next: { revalidate: 21_600 },
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { data?: { Media?: AniListMedia } };
    return payload.data?.Media ?? null;
  } catch {
    return null;
  }
}

/** Clean AniList's HTML-ish synopsis into plain text. */
const plain = (html?: string) =>
  html
    ? html
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/\(\s*Source:.*?\)/gi, "")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim() || undefined
    : undefined;

export async function animeInfo({
  anilistId,
  malId,
}: {
  anilistId?: number;
  malId?: number;
}): Promise<AnimeInfo | null> {
  const cacheKey = `${anilistId ?? ""}|${malId ?? ""}`;
  if (!anilistId && !malId) return null;

  const hit = animeInfoCache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const media = await anilist(anilistId ? { id: anilistId } : { mal: malId });
  if (!media) {
    animeInfoCache.set(cacheKey, { value: null, at: Date.now() });
    return null;
  }

  const info: AnimeInfo = {
    anilistId: media.id,
    malId: media.idMal ?? malId,
    name: media.title?.english || media.title?.romaji || `Anime ${media.id}`,
    overview: plain(media.description),
    year: media.seasonYear ?? undefined,
    rating: media.averageScore ? Math.round(media.averageScore) / 10 : undefined,
    episodes: media.episodes ?? 0,
    runtime: media.duration ?? 24,
    poster: media.coverImage?.extraLarge ?? media.coverImage?.large,
    backdrop: media.bannerImage ?? media.coverImage?.extraLarge,
    genres: media.genres ?? [],
    format: media.format ?? undefined,
    status: media.status ?? undefined,
  };

  animeInfoCache.set(cacheKey, { value: info, at: Date.now() });
  return info;
}

type JikanEpisode = {
  mal_id?: number;
  title?: string;
  aired?: string;
  filler?: boolean;
  recap?: boolean;
};

/**
 * Real anime episodes.
 *
 * Anime numbers its episodes continuously rather than in seasons, so this is a
 * single season list — but a *real* one: Jikan (MyAnimeList) returns the actual
 * episode titles and air dates, 100 per page, and we read as many pages as the
 * episode count needs.
 */
export async function animeSeasons({
  anilistId,
  malId,
}: {
  anilistId?: number;
  malId?: number;
}): Promise<Season[]> {
  const cacheKey = `${anilistId ?? ""}|${malId ?? ""}`;
  if (!anilistId && !malId) return [];

  const hit = animeSeasonCache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const info = await animeInfo({ anilistId, malId });
  const resolvedMal = info?.malId ?? malId;
  if (!resolvedMal) return [];

  const total = Math.min(info?.episodes || 0, 1200);
  const pages = Math.max(1, Math.min(Math.ceil((total || 100) / 100), 6));

  const collected: JikanEpisode[] = [];
  for (let page = 1; page <= pages; page++) {
    try {
      const res = await fetch(`${JIKAN}/anime/${resolvedMal}/episodes?page=${page}`, {
        headers: { accept: "application/json" },
        next: { revalidate: 21_600 },
      });
      if (!res.ok) break;
      const payload = (await res.json()) as { data?: JikanEpisode[] };
      const batch = payload.data ?? [];
      if (!batch.length) break;
      collected.push(...batch);
      if (total && collected.length >= total) break;
    } catch {
      break;
    }
  }

  /* Jikan has no episode list for some titles (movies, specials): fall back to
     a plain numbered run so the player still has something to advance */
  const episodes: Episode[] = collected.length
    ? collected.map((entry, index) => ({
        number: index + 1,
        name: entry.title?.trim() || `Episode ${index + 1}`,
        runtime: info?.runtime ?? 24,
        overview: "",
        airDate: entry.aired ? entry.aired.slice(0, 10) : undefined,
      }))
    : Array.from({ length: Math.min(total || 1, 1200) }, (_, index) => ({
        number: index + 1,
        name: `Episode ${index + 1}`,
        runtime: info?.runtime ?? 24,
        overview: "",
      }));

  const value: Season[] = [
    {
      number: 1,
      year: info?.year ?? new Date().getFullYear(),
      name: "Episodes",
      episodes,
    },
  ];

  animeSeasonCache.set(cacheKey, { value, at: Date.now() });
  return value;
}

/** Seasons for a title that may or may not be a real TMDB show. */
export async function seasonsForTmdb(
  tmdbId: number | undefined,
  fallback: Season[],
): Promise<Season[]> {
  if (!tmdbId || tmdbId <= 0) return fallback;
  const seasons = await realSeasons(tmdbId);
  return seasons.length ? seasons : fallback;
}
