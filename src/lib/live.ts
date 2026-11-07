"use client";

/**
 * Live catalogue.
 *
 * The bundled catalogue is finite; this module streams more titles straight
 * from public APIs **in the browser**, which is the only place that always has
 * network (Vercel/sandbox serverless functions can be firewalled).
 *
 *  - TMDB      → unlimited movies, series and anime (needs a free API key)
 *  - Jikan     → top anime with covers, keyless
 *  - AniList   → resolves a MAL id to the AniList id the player's /anime route wants
 */

export type LiveItem = {
  id: string;
  imdbId?: string;
  tmdbId?: number;
  anilistId?: number;
  malId?: number;
  name: string;
  year?: number;
  kind: "movie" | "series";
  poster?: string;
  rating?: number;
  overview?: string;
  anime?: boolean;
  /** TMDB genre ids — lets kids profiles filter live results properly */
  genres?: number[];
  /** TMDB "adult" flag */
  mature?: boolean;
};

import { TMDB_API_KEY } from "@/lib/tmdb-key";

const KEY_STORAGE = "nf.tmdb";

export function getKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function setKey(key: string) {
  try {
    window.localStorage.setItem(KEY_STORAGE, key.trim());
  } catch {
    /* ignore */
  }
}

/** always true: the site ships with a working TMDB key baked in */
export const hasKey = () => Boolean(getKey() || TMDB_API_KEY);

async function json<T>(url: string, timeout = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const IMG = "https://image.tmdb.org/t/p/w500";

type TmdbItem = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
  overview?: string;
  original_language?: string;
  genre_ids?: number[];
};

function mapTmdb(item: TmdbItem, kind?: "movie" | "series", anime = false): LiveItem {
  const type = kind ?? (item.media_type === "tv" || (!item.title && Boolean(item.name)) ? "series" : "movie");
  return {
    id: `tmdb-${item.id}`,
    tmdbId: item.id,
    name: item.title ?? item.name ?? "Untitled",
    year: Number((item.release_date ?? item.first_air_date ?? "").slice(0, 4)) || undefined,
    kind: type,
    poster: item.poster_path ? `${IMG}${item.poster_path}` : undefined,
    rating: item.vote_average,
    overview: item.overview,
    anime: anime || (item.original_language === "ja" && (item.genre_ids ?? []).includes(16)),
    genres: item.genre_ids ?? [],
    mature: Boolean((item as { adult?: boolean }).adult),
  };
}

/** TMDB hands out two credentials: a v3 key (32 chars) and a v4 read token (JWT). */
const isBearer = (key: string) => key.startsWith("eyJ");

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string> = {},
  key = getKey() || TMDB_API_KEY,
): Promise<T | null> {
  if (!key) return null;
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("language", "en-US");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  if (!isBearer(key)) url.searchParams.set("api_key", key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(isBearer(key) ? { authorization: `Bearer ${key}` } : {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Returns true when TMDB accepts the credential — used before we save it. */
export async function validateKey(key: string): Promise<boolean> {
  const clean = key.trim();
  if (!clean) return false;
  const config = await tmdbFetch<{ images?: unknown }>("/configuration", {}, clean);
  return Boolean(config?.images);
}

export type Shelf = { id: string; title: string; hint?: string; items: LiveItem[] };

/** TMDB shelves — the big one. */
export async function tmdbShelves(): Promise<Shelf[]> {
  const key = getKey() || TMDB_API_KEY;
  if (!key) return [];

  const [trending, movies, series, anime, topRated, animeFilms, anime2] = await Promise.all([
    tmdbFetch<{ results?: TmdbItem[] }>("/trending/all/week", { page: "1" }, key),
    tmdbFetch<{ results?: TmdbItem[] }>("/movie/popular", { page: "1" }, key),
    tmdbFetch<{ results?: TmdbItem[] }>("/tv/popular", { page: "1" }, key),
    tmdbFetch<{ results?: TmdbItem[] }>(
      "/discover/tv",
      { with_genres: "16", with_original_language: "ja", sort_by: "popularity.desc", page: "1" },
      key,
    ),
    tmdbFetch<{ results?: TmdbItem[] }>("/movie/top_rated", { page: "1" }, key),
    tmdbFetch<{ results?: TmdbItem[] }>(
      "/discover/movie",
      { with_genres: "16", with_original_language: "ja", sort_by: "popularity.desc", page: "1" },
      key,
    ),
    tmdbFetch<{ results?: TmdbItem[] }>(
      "/discover/tv",
      { with_genres: "16", with_original_language: "ja", sort_by: "trending.desc".replace("trending", "vote_count"), page: "2" },
      key,
    ),
  ]);

  const shelves: Shelf[] = [
    {
      id: "live-trending",
      title: "Trending This Week",
      hint: "Live from TMDB",
      items: (trending?.results ?? []).filter((i) => i.media_type !== "person").map((i) => mapTmdb(i)),
    },
    { id: "live-movies", title: "Popular Movies Right Now", items: (movies?.results ?? []).map((i) => mapTmdb(i, "movie")) },
    { id: "live-series", title: "Popular Series Right Now", items: (series?.results ?? []).map((i) => mapTmdb(i, "series")) },
    {
      id: "live-anime",
      title: "Trending Anime",
      hint: "Japanese animation, freshly ranked",
      items: [
        ...(anime?.results ?? []).map((i) => mapTmdb(i, "series", true)),
        ...(anime2?.results ?? []).map((i) => mapTmdb(i, "series", true)),
      ],
    },
    {
      id: "live-anime-films",
      title: "Anime Films",
      hint: "Feature-length animation",
      items: (animeFilms?.results ?? []).map((i) => mapTmdb(i, "movie", true)),
    },
    { id: "live-top-rated", title: "All-Time Top Rated", items: (topRated?.results ?? []).map((i) => mapTmdb(i, "movie")) },
  ];

  return shelves.filter((shelf) => shelf.items.length > 0);
}

/** Keyless series shelf (TVMaze) — 3 pages, ranked by community rating. */
export async function tvmazeShelf(): Promise<Shelf | null> {
  const pages = await Promise.all(
    [0, 1, 2].map((page) =>
      json<
        Array<{
          show: {
            id: number;
            name: string;
            premiered?: string;
            rating?: { average?: number };
            image?: { medium?: string; original?: string };
            summary?: string;
            externals?: { imdb?: string | null };
            genres?: string[];
          };
        }>
      >(`https://api.tvmaze.com/shows?page=${page}`),
    ),
  );

  const shows = pages
    .flatMap((page) => page ?? [])
    .map((entry) => entry.show)
    .filter((show) => show?.name && show.image && (show.rating?.average ?? 0) >= 7.5 && show.externals?.imdb)
    .sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0))
    .slice(0, 40);

  if (!shows.length) return null;

  return {
    id: "live-tvmaze",
    title: "Highly Rated Series",
    hint: "Keyless · TVMaze",
    items: shows.map((show) => ({
      id: `tvmaze-${show.id}`,
      imdbId: show.externals?.imdb ?? undefined,
      name: show.name,
      year: Number(show.premiered?.slice(0, 4)) || undefined,
      kind: "series" as const,
      poster: show.image?.original ?? show.image?.medium,
      rating: show.rating?.average ?? undefined,
      overview: show.summary?.replace(/<[^>]+>/g, "").trim(),
    })),
  };
}

/** IMDb id → TMDB id, so a TVMaze show can be played by the embed. */
export async function resolveTmdbId(imdbId: string): Promise<number | null> {
  const data = await json<{ meta?: { moviedb_id?: number } }>(
    `https://v3-cinemeta.strem.io/meta/series/${imdbId}.json`,
  );
  return data?.meta?.moviedb_id ?? null;
}

/** Keyless anime shelf (Jikan / MyAnimeList). */
export async function jikanShelf(): Promise<Shelf | null> {
  type JikanPage = {
    data: Array<{
      mal_id: number;
      title_english?: string;
      title: string;
      year?: number;
      score?: number;
      synopsis?: string;
      images?: { jpg?: { large_image_url?: string; image_url?: string } };
    }>;
  };

  const [first, second] = await Promise.all([
    json<JikanPage>("https://api.jikan.moe/v4/top/anime?limit=25&sfw"),
    json<JikanPage>("https://api.jikan.moe/v4/top/anime?limit=25&page=2&sfw"),
  ]);

  const rows = [...(first?.data ?? []), ...(second?.data ?? [])];
  if (!rows.length) return null;

  return {
    id: "live-jikan",
    title: "Anime Everyone Is Watching",
    hint: "Keyless · MyAnimeList",
    items: rows.map((item) => ({
      id: `mal-${item.mal_id}`,
      malId: item.mal_id,
      name: item.title_english ?? item.title,
      year: item.year,
      kind: "series" as const,
      poster: item.images?.jpg?.large_image_url ?? item.images?.jpg?.image_url,
      rating: item.score,
      overview: item.synopsis,
      anime: true,
    })),
  };
}

/** MAL id → AniList id (the /anime/{anilistId}/{episode} route needs it). */
export async function resolveAnilistId(malId: number): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        query: "query($m:Int){Media(idMal:$m,type:ANIME){id}}",
        variables: { m: malId },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { Media?: { id?: number } } };
    return data.data?.Media?.id ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function playHref(item: LiveItem): string | null {
  if (item.anilistId) {
    return `/play/${item.anilistId}?title=${encodeURIComponent(item.name)}&kind=series&anime=1&year=${item.year ?? ""}`;
  }
  if (item.tmdbId) {
    return `/play/${item.tmdbId}?title=${encodeURIComponent(item.name)}&kind=${item.kind}&year=${item.year ?? ""}`;
  }
  return null;
}
