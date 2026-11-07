import { TMDB_API_KEY } from "@/lib/tmdb-key";

/**
 * The living catalogue.
 *
 * The bundled 150 titles power the hero, the shelves and instant search, but
 * the real library is TMDB: tens of thousands of films, series and anime that
 * we page in on demand, 60 at a time, straight from the browser (the key is
 * public by design). Every item here is playable through /play/{tmdbId}.
 */

export type CatalogItem = {
  key: string;
  tmdbId: number;
  kind: "movie" | "series";
  name: string;
  year?: number;
  rating?: number;
  poster?: string;
  overview?: string;
  anime?: boolean;
};

export type Tab = "movie" | "series" | "anime";

const ENDPOINT = "https://api.themoviedb.org/3";
const POSTER = "https://image.tmdb.org/t/p/w342";

export const MOVIE_GENRES: Array<{ id: number; name: string }> = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 27, name: "Horror" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Sci-Fi" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
];

export const SERIES_GENRES: Array<{ id: number; name: string }> = [
  { id: 10759, name: "Action & Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 9648, name: "Mystery" },
  { id: 10765, name: "Sci-Fi & Fantasy" },
  { id: 10764, name: "Reality" },
  { id: 10766, name: "Soap" },
  { id: 10768, name: "War & Politics" },
  { id: 37, name: "Western" },
];

type RawItem = {
  id: number;
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

const cache = new Map<string, CatalogItem[]>();
const seen = new Set<string>();

async function fetchPage(path: string, params: Record<string, string>): Promise<RawItem[]> {
  const url = new URL(`${ENDPOINT}${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  url.searchParams.set("include_adult", "false");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: RawItem[] };
    return json.results ?? [];
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}

function map(item: RawItem, kind: "movie" | "series", anime = false): CatalogItem {
  return {
    key: `${kind}-${item.id}`,
    tmdbId: item.id,
    kind,
    name: item.title ?? item.name ?? "Untitled",
    year: Number((item.release_date ?? item.first_air_date ?? "").slice(0, 4)) || undefined,
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : undefined,
    poster: item.poster_path ? `${POSTER}${item.poster_path}` : undefined,
    overview: item.overview,
    anime:
      anime ||
      (item.original_language === "ja" && (item.genre_ids ?? []).some((id) => id === 16)),
  };
}

function unique(items: CatalogItem[]): CatalogItem[] {
  const out: CatalogItem[] = [];
  for (const item of items) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }
  return out;
}

/** Wipe dedupe memory (used when the filter changes so results start fresh). */
export function resetCatalogue() {
  cache.clear();
  seen.clear();
}

/**
 * One page of results — 40 for anime (series + films interleaved), 20 otherwise.
 */
export async function discoverPage(opts: {
  tab: Tab;
  page: number;
  genreId?: number;
  reset?: boolean;
}): Promise<CatalogItem[]> {
  const { tab, page, genreId } = opts;
  if (opts.reset) resetCatalogue();

  const cacheKey = `${tab}:${genreId ?? 0}:${page}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const common = { sort_by: "popularity.desc", page: String(page) };
  const genre = genreId ? String(genreId) : undefined;

  let items: CatalogItem[] = [];

  if (tab === "movie") {
    items = (
      await fetchPage("/discover/movie", { ...common, ...(genre ? { with_genres: genre } : {}) })
    ).map((i) => map(i, "movie"));
  } else if (tab === "series") {
    items = (
      await fetchPage("/discover/tv", { ...common, ...(genre ? { with_genres: genre } : {}) })
    ).map((i) => map(i, "series"));
  } else {
    const animeParams = { with_genres: "16", with_original_language: "ja", ...common };
    const [tv, film] = await Promise.all([
      fetchPage("/discover/tv", animeParams),
      fetchPage("/discover/movie", animeParams),
    ]);
    const a = tv.map((i) => map(i, "series", true));
    const b = film.map((i) => map(i, "movie", true));
    items = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i]) items.push(a[i]);
      if (b[i]) items.push(b[i]);
    }
  }

  const fresh = unique(items);
  cache.set(cacheKey, fresh);
  return fresh;
}
