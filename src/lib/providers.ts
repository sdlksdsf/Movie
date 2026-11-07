import "server-only";

import { TMDB_API_KEY } from "@/lib/tmdb-key";

/**
 * Multi-provider metadata pipeline.
 *
 * Every adapter is keyless except TMDB (a free key unlocks the full 1M-title
 * catalogue, backdrops and trailers). All of them fail soft: if the network is
 * blocked or a provider is down we simply return an empty list, so the bundled
 * catalogue keeps the app fully usable offline.
 */

export type ExternalTitle = {
  source: "tmdb" | "tvmaze" | "jikan" | "imdb";
  /** TMDB id when we know it — this is what the CineLite player needs. */
  tmdbId?: number;
  /** anime results carry their own ids so they reach an anime server */
  anime?: boolean;
  anilistId?: number;
  malId?: number;
  name: string;
  year?: number;
  kind: "movie" | "series";
  overview?: string;
  poster?: string;
  rating?: number;
};

/* the site ships with a working key, so TMDB is always enabled */
const TMDB_KEY = process.env.TMDB_API_KEY ?? process.env.NEXT_PUBLIC_TMDB_API_KEY ?? TMDB_API_KEY;

export const providers = {
  tmdb: {
    id: "tmdb",
    label: "TMDB",
    needsKey: true,
    enabled: Boolean(TMDB_KEY),
    docs: "https://developer.themoviedb.org/docs/getting-started",
    gives: "Movies + series, posters, backdrops, trailers, full metadata",
  },
  tvmaze: {
    id: "tvmaze",
    label: "TVMaze",
    needsKey: false,
    enabled: true,
    docs: "https://www.tvmaze.com/api",
    gives: "Series, episodes, cast, posters — no key required",
  },
  jikan: {
    id: "jikan",
    label: "Jikan (MyAnimeList)",
    needsKey: false,
    enabled: true,
    docs: "https://docs.api.jikan.moe/",
    gives: "Anime series & films — no key required",
  },
  imdb: {
    id: "imdb",
    label: "IMDb suggestions",
    needsKey: false,
    enabled: true,
    docs: "https://developer.imdb.com/",
    gives: "Titles, year, poster art — no key required",
  },
} as const;

async function getJson<T>(url: string, timeout = 3200): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* TMDB                                                                */
/* ------------------------------------------------------------------ */

type TmdbItem = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
};

async function tmdb(path: string, params: Record<string, string> = {}): Promise<{ results?: TmdbItem[] } | null> {
  if (!TMDB_KEY) return null;
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  if (TMDB_KEY.startsWith("ey")) {
    // v4 bearer token
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3200);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { authorization: `Bearer ${TMDB_KEY}`, accept: "application/json" },
        next: { revalidate: 3600 },
      });
      if (!res.ok) return null;
      return (await res.json()) as { results?: TmdbItem[] };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  url.searchParams.set("api_key", TMDB_KEY);
  return getJson<{ results?: TmdbItem[] }>(url.toString());
}

function mapTmdb(item: TmdbItem): ExternalTitle {
  return {
    source: "tmdb",
    tmdbId: item.id,
    name: item.title ?? item.name ?? "Untitled",
    year: Number((item.release_date ?? item.first_air_date ?? "").slice(0, 4)) || undefined,
    kind: item.media_type === "tv" || (!item.title && Boolean(item.name)) ? "series" : "movie",
    overview: item.overview,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
    rating: item.vote_average,
  };
}

/* ------------------------------------------------------------------ */
/* TVMaze (keyless)                                                    */
/* ------------------------------------------------------------------ */

type TvMazeShow = {
  id: number;
  name: string;
  premiered?: string;
  genres?: string[];
  summary?: string;
  image?: { medium?: string; original?: string };
  rating?: { average?: number };
};

async function tvmazeSearch(query: string): Promise<ExternalTitle[]> {
  const data = await getJson<Array<{ show: TvMazeShow }>>(
    `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
  );
  if (!data) return [];
  return data.slice(0, 8).map(({ show }) => ({
    source: "tvmaze" as const,
    name: show.name,
    year: Number(show.premiered?.slice(0, 4)) || undefined,
    kind: "series" as const,
    overview: show.summary?.replace(/<[^>]+>/g, "").trim(),
    poster: show.image?.original ?? show.image?.medium,
    rating: show.rating?.average ?? undefined,
  }));
}

/* ------------------------------------------------------------------ */
/* Jikan / MyAnimeList (keyless)                                       */
/* ------------------------------------------------------------------ */

async function jikanSearch(query: string): Promise<ExternalTitle[]> {
  const data = await getJson<{
    data: Array<{
      mal_id?: number;
      title: string;
      year?: number;
      synopsis?: string;
      images?: { jpg?: { large_image_url?: string } };
      score?: number;
      type?: string;
      episodes?: number;
    }>;
  }>(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=6&sfw`);
  if (!data?.data) return [];
  return data.data.map((a) => ({
    source: "jikan" as const,
    anime: true,
    malId: a.mal_id,
    name: a.title,
    year: a.year,
    kind: "series" as const,
    overview: a.synopsis,
    poster: a.images?.jpg?.large_image_url,
    rating: a.score,
  }));
}

/* ------------------------------------------------------------------ */
/* IMDb suggestions (keyless)                                          */
/* ------------------------------------------------------------------ */

async function imdbSearch(query: string): Promise<ExternalTitle[]> {
  const slug = encodeURIComponent(query.trim().toLowerCase());
  const data = await getJson<{
    d: Array<{ id: string; l: string; y?: number; q?: string; s?: string; i?: { imageUrl?: string } }>;
  }>(`https://v2.sg.media-imdb.com/suggestion/i/${slug}.json`);
  if (!data?.d) return [];
  return data.d
    .filter((item) => item.id.startsWith("tt") && item.l)
    .slice(0, 8)
    .map((item) => ({
      source: "imdb" as const,
      name: item.l,
      year: item.y,
      kind: /TV|series/i.test(item.q ?? "") ? ("series" as const) : ("movie" as const),
      overview: item.s ? `Starring ${item.s}.` : undefined,
      poster: item.i?.imageUrl,
    }));
}

/** Fan out to every enabled provider and de-duplicate by title + year. */
export async function externalSearch(query: string): Promise<ExternalTitle[]> {
  if (!query.trim()) return [];
  const tasks: Array<Promise<ExternalTitle[]>> = [tvmazeSearch(query), imdbSearch(query)];
  if (TMDB_KEY) {
    tasks.push(
      tmdb("/search/multi", { query, include_adult: "false" }).then((r) =>
        (r?.results ?? []).filter((i) => i.media_type !== "person").map(mapTmdb),
      ),
    );
  }
  if (/anime|naruto|one piece|jujutsu|demon slayer|attack on titan|ghibli/i.test(query)) {
    tasks.push(jikanSearch(query));
  }

  const settled = await Promise.allSettled(tasks);
  const seen = new Map<string, ExternalTitle>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      const key = `${item.name.toLowerCase().trim()}|${item.year ?? ""}`;
      if (!seen.has(key)) seen.set(key, item);
    }
  }
  return [...seen.values()];
}

/** Trending/popular shelf, when a TMDB key is present. */
export async function externalTrending(): Promise<ExternalTitle[]> {
  const data = await tmdb("/trending/all/week");
  return (data?.results ?? []).filter((i) => i.media_type !== "person").slice(0, 20).map(mapTmdb);
}
