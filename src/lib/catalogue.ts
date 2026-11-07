/**
 * The catalogue builder (server side).
 *
 * The bundled JSON ships ~150 curated titles so the site paints instantly and
 * works offline. Everything beyond that is assembled here: exactly
 * `CATALOGUE_TARGET` films, series and anime — 1,000 of each — pulled from
 * TMDB's discover endpoints, deduped, ordered by popularity and cached for six
 * hours at the edge.
 *
 * This module runs on the server only (API route), so the credential never has
 * to appear in a browser request. Never import it from a client component.
 */

import { TMDB_API_KEY, isBearerToken } from "@/lib/tmdb-key";

export type CatalogueTab = "movie" | "series" | "anime";

export type CatalogueEntry = {
  key: string;
  tmdbId: number;
  kind: "movie" | "series";
  name: string;
  year?: number;
  rating?: number;
  poster?: string;
  backdrop?: string;
  overview?: string;
  /** TMDB genre ids — drives the kids filter and the genre chips */
  genres: number[];
  anime?: boolean;
};

/** How many titles each tab holds once it is fully built. */
export const CATALOGUE_TARGET = 1000;

const ENDPOINT = "https://api.themoviedb.org/3";
const POSTER = "https://image.tmdb.org/t/p/w342";
const BACKDROP = "https://image.tmdb.org/t/p/w780";

/** Genres a kids profile may see (animation, family, kids). */
const KIDS_ALLOWED = [16, 10751, 10762];
/** Genres a kids profile must never see. */
const KIDS_BLOCKED = [27, 53, 80, 10752, 10768, 10764];

const key = () =>
  (process.env.TMDB_API_KEY ?? process.env.NEXT_PUBLIC_TMDB_API_KEY ?? TMDB_API_KEY ?? "").trim();

export const hasCatalogueKey = () => Boolean(key());

type RawItem = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  overview?: string;
  original_language?: string;
  genre_ids?: number[];
  adult?: boolean;
};

const yearOf = (item: RawItem) =>
  Number((item.release_date ?? item.first_air_date ?? "").slice(0, 4)) || undefined;

function map(item: RawItem, kind: "movie" | "series", anime: boolean): CatalogueEntry {
  return {
    key: `${kind}-${item.id}`,
    tmdbId: item.id,
    kind,
    name: item.title ?? item.name ?? "Untitled",
    year: yearOf(item),
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : undefined,
    poster: item.poster_path ? `${POSTER}${item.poster_path}` : undefined,
    backdrop: item.backdrop_path ? `${BACKDROP}${item.backdrop_path}` : undefined,
    overview: item.overview || undefined,
    genres: item.genre_ids ?? [],
    anime,
  };
}

async function tmdb(
  path: string,
  params: Record<string, string>,
): Promise<RawItem[]> {
  const credential = key();
  if (!credential) return [];

  const url = new URL(`${ENDPOINT}${path}`);
  url.searchParams.set("language", "en-US");
  url.searchParams.set("include_adult", "false");
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));

  const headers: Record<string, string> = { accept: "application/json" };
  if (isBearerToken(credential)) headers.authorization = `Bearer ${credential}`;
  else url.searchParams.set("api_key", credential);

  try {
    const res = await fetch(url.toString(), { headers, next: { revalidate: 21_600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: RawItem[] };
    /* a title with no artwork or no name is a blank card — drop it here so the
       grid can never show an empty tile */
    return (json.results ?? []).filter(
      (item) => item?.id && (item.title || item.name) && item.poster_path,
    );
  } catch {
    return [];
  }
}

type PagePlan = { path: string; kind: "movie" | "series"; params: Record<string, string> };

function planFor(tab: CatalogueTab): PagePlan[] {
  if (tab === "movie") {
    return [
      { path: "/discover/movie", kind: "movie", params: { sort_by: "popularity.desc" } },
    ];
  }
  if (tab === "series") {
    return [
      { path: "/discover/tv", kind: "series", params: { sort_by: "popularity.desc" } },
    ];
  }
  /* anime: Japanese animation only, series and films interleaved */
  const animeParams = {
    sort_by: "popularity.desc",
    with_genres: "16",
    with_origin_country: "JP",
  };
  return [
    { path: "/discover/tv", kind: "series", params: animeParams },
    { path: "/discover/movie", kind: "movie", params: animeParams },
  ];
}

type Cache = { at: number; items: CatalogueEntry[] };
const memo = new Map<CatalogueTab, Cache>();
const TTL = 6 * 60 * 60 * 1000;
/* ~50 pages of 20 is what 1,000 titles costs; leave headroom for gaps */
const MAX_PAGE = 60;

/**
 * Build (or reuse) the catalogue for one tab: exactly `CATALOGUE_TARGET`
 * unique, artwork-complete titles, popularity ordered.
 */
export async function buildCatalogue(tab: CatalogueTab): Promise<CatalogueEntry[]> {
  const hit = memo.get(tab);
  if (hit && Date.now() - hit.at < TTL) return hit.items;

  const plan = planFor(tab);
  const anime = tab === "anime";
  const out: CatalogueEntry[] = [];
  const seen = new Set<number>();

  /* pages are fetched in small parallel batches — fast, but never a burst that
     TMDB would rate-limit */
  const BATCH = 8;
  for (let base = 1; base <= MAX_PAGE && out.length < CATALOGUE_TARGET; base += BATCH) {
    const jobs: Array<Promise<RawItem[]>> = [];
    for (let offset = 0; offset < BATCH; offset++) {
      const page = base + offset;
      for (const source of plan) {
        jobs.push(tmdb(source.path, { ...source.params, page: String(page) }));
      }
    }
    const settled = await Promise.all(jobs);
    if (settled.every((rows) => rows.length === 0)) break;

    /* interleave the anime sources so series and films alternate */
    const perPage = plan.length;
    for (let index = 0; index < settled.length; index += perPage) {
      const slots = settled.slice(index, index + perPage);
      const longest = Math.max(...slots.map((rows) => rows.length));
      for (let row = 0; row < longest; row++) {
        for (let s = 0; s < slots.length; s++) {
          const item = slots[s][row];
          if (!item || seen.has(item.id)) continue;
          seen.add(item.id);
          out.push(map(item, plan[s].kind, anime));
          if (out.length >= CATALOGUE_TARGET) break;
        }
        if (out.length >= CATALOGUE_TARGET) break;
      }
      if (out.length >= CATALOGUE_TARGET) break;
    }
  }

  const items = out.slice(0, CATALOGUE_TARGET);
  memo.set(tab, { at: Date.now(), items });
  return items;
}

export function isKidsEntry(entry: CatalogueEntry) {
  if (entry.genres.some((g) => KIDS_BLOCKED.includes(g))) return false;
  if (!entry.genres.some((g) => KIDS_ALLOWED.includes(g))) return false;
  return (entry.rating ?? 0) >= 5.5;
}
