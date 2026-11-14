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
  /**
   * Which sweep found it. `kids` = certified G/PG or family animation,
   * `mature` = R / TV-MA / crime / horror.
   */
  audience?: Audience;
};

export type Audience = "kids" | "mature" | "general";

/**
 * How many titles each tab holds. Raised from 1,000 to 2,500 now that the
 * builder sweeps several decades per tab instead of one popularity query — the
 * old plan could only ever surface the same modern hits.
 */
export const CATALOGUE_TARGET = 2500;

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

function map(
  item: RawItem,
  kind: "movie" | "series",
  anime: boolean,
  audience: Audience = "general",
): CatalogueEntry {
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
    audience,
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
  /* adult titles are never requested, from any sweep */
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

type PagePlan = {
  path: string;
  kind: "movie" | "series";
  params: Record<string, string>;
  audience?: Audience;
};

/** TMDb keyword 210024 = "anime". */
const ANIME_KEYWORD = "210024";

/** Decades we sweep, so the shelves are not just "popular in the last 18 months". */
const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

/**
 * The queries behind one tab.
 *
 * One `popularity.desc` sweep can only ever return the same modern hits, which
 * is why the old 1,000-title catalogue felt small. Each tab now sweeps an
 * all-time popularity pass *plus* every decade, and — for anime — both series
 * and films. The builder interleaves them, so the first screen is still the
 * popular stuff and the rest of the shelf is deep catalogue.
 */
function planFor(tab: CatalogueTab): PagePlan[] {
  /* only titles that already exist, with a real audience — an unreleased
     blockbuster looks great on a poster wall but nothing can play it yet, and
     vote_count keeps out the no-name filler */
  const today = new Date().toISOString().slice(0, 10);
  const quality = { sort_by: "popularity.desc", "vote_count.gte": "50" };

  const moviePlan = (
    extra: Record<string, string> = {},
    audience: Audience = "general",
  ): PagePlan => ({
    path: "/discover/movie",
    kind: "movie",
    params: { ...quality, "primary_release_date.lte": today, ...extra },
    audience,
  });
  const seriesPlan = (
    extra: Record<string, string> = {},
    audience: Audience = "general",
  ): PagePlan => ({
    path: "/discover/tv",
    kind: "series",
    params: { ...quality, "first_air_date.lte": today, ...extra },
    audience,
  });

  /* US certifications are the only reliable "R-rated" / "kids" signal TMDb
     exposes at discover time, and /discover/tv has no certification filter at
     all — so series are shelved by genre instead. */
  const cert = (rating: string) => ({
    certification_country: "US",
    certification: rating,
  });
  const MATURE_TV_GENRES = "80|53|27|9648"; // crime, thriller, horror, mystery
  const KIDS_TV_GENRES = "10762|10751|16"; // kids, family, animation

  const decades = (path: "movie" | "series", extra: Record<string, string> = {}): PagePlan[] =>
    DECADES.map((decade) => {
      const from = `${decade}-01-01`;
      const to = `${decade + 9}-12-31`;
      return path === "movie"
        ? moviePlan({
            "primary_release_date.gte": from,
            "primary_release_date.lte": to > today ? today : to,
            ...extra,
          })
        : seriesPlan({
            "first_air_date.gte": from,
            "first_air_date.lte": to > today ? today : to,
            ...extra,
          });
    });

  if (tab === "movie") {
    return [
      moviePlan(),
      moviePlan({ sort_by: "vote_count.desc", "vote_count.gte": "400" }),
      ...decades("movie"),
      /* mature: real R-rated films */
      moviePlan(cert("R"), "mature"),
      moviePlan({ ...cert("R"), sort_by: "vote_count.desc", "vote_count.gte": "250" }, "mature"),
      ...DECADES.map((decade) =>
        moviePlan(
          {
            ...cert("R"),
            "primary_release_date.gte": `${decade}-01-01`,
            "primary_release_date.lte": `${decade + 9}-12-31` > today ? today : `${decade + 9}-12-31`,
          },
          "mature",
        ),
      ),
      /* kids: certified G and PG, plus family animation */
      moviePlan(cert("G"), "kids"),
      moviePlan(cert("PG"), "kids"),
      moviePlan({ with_genres: "10751|16", "vote_count.gte": "30" }, "kids"),
    ];
  }
  if (tab === "series") {
    return [
      seriesPlan(),
      seriesPlan({ sort_by: "vote_count.desc", "vote_count.gte": "300" }),
      ...decades("series"),
      /* mature series: crime, thriller, horror, mystery */
      seriesPlan({ with_genres: MATURE_TV_GENRES, "vote_count.gte": "120" }, "mature"),
      seriesPlan({ with_genres: "10759|18", "vote_count.gte": "150" }, "mature"),
      /* kids series: kids, family, animation with a family-safe floor */
      seriesPlan({ with_genres: KIDS_TV_GENRES, "vote_count.gte": "40" }, "kids"),
      seriesPlan({ with_genres: "10762", "vote_count.gte": "15" }, "kids"),
    ];
  }

  /*
   * anime: Japanese animation, series and films interleaved.
   *
   * Deeper catalogue means shallower vote counts — TMDb's anime back catalogue
   * has far fewer votes per title than live-action prime time, so the 50-vote
   * floor that keeps the film shelves clean would starve this tab. Two thousand
   * plus titles needs the floor down at 10, an original-language sweep, and a
   * keyword pass for anime that TMDb has not tagged `JP`.
   */
  const japan = {
    with_genres: "16",
    with_origin_country: "JP",
    "vote_count.gte": "10",
  };
  const japaneseLanguage = {
    with_genres: "16",
    with_original_language: "ja",
    "vote_count.gte": "10",
  };
  const animeKeyword = {
    with_genres: "16",
    with_keywords: ANIME_KEYWORD,
    "vote_count.gte": "10",
  };
  return [
    seriesPlan(japan),
    moviePlan(japan),
    seriesPlan(japaneseLanguage),
    moviePlan(japaneseLanguage),
    seriesPlan({ ...japan, sort_by: "vote_count.desc", "vote_count.gte": "200" }),
    moviePlan({ ...japan, sort_by: "vote_count.desc", "vote_count.gte": "200" }),
    seriesPlan(animeKeyword),
    moviePlan(animeKeyword),
    ...decades("series", japan),
    ...decades("movie", japan),
    ...decades("series", japaneseLanguage),
    ...decades("movie", japaneseLanguage),
  ];
}

type Cache = { at: number; items: CatalogueEntry[] };
const memo = new Map<string, Cache>();
const TTL = 6 * 60 * 60 * 1000;
/* 2,500 titles across a dozen interleaved sweeps costs ~140 pages of 20 */
const MAX_PAGE = 220;

/**
 * Build (or reuse) the catalogue for one tab: exactly `CATALOGUE_TARGET`
 * unique, artwork-complete titles, popularity ordered.
 */
export async function buildCatalogue(tab: CatalogueTab): Promise<CatalogueEntry[]> {
  const cacheKey = `${tab}:shelf`;
  const hit = memo.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit.items;
  const items = await buildShelf(tab);
  memo.set(cacheKey, { at: Date.now(), items });
  return items;
}

/** The general shelf for one tab: audience-tagged, `CATALOGUE_TARGET` long. */
async function buildShelf(tab: CatalogueTab): Promise<CatalogueEntry[]> {
  const cached = memo.get(`${tab}:shelf`);
  if (cached && Date.now() - cached.at < TTL) return cached.items;

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
          out.push(map(item, plan[s].kind, anime, plan[s].audience ?? "general"));
          if (out.length >= CATALOGUE_TARGET) break;
        }
        if (out.length >= CATALOGUE_TARGET) break;
      }
      if (out.length >= CATALOGUE_TARGET) break;
    }
  }

  const items = out.slice(0, CATALOGUE_TARGET);
  memo.set(`${tab}:shelf`, { at: Date.now(), items });
  return items;
}

export function isKidsEntry(entry: CatalogueEntry) {
  if (entry.genres.some((g) => KIDS_BLOCKED.includes(g))) return false;
  if (!entry.genres.some((g) => KIDS_ALLOWED.includes(g))) return false;
  return (entry.rating ?? 0) >= 5.5;
}
