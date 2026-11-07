import type { Genre, Title } from "@/lib/types";
import entries from "./catalog.generated.json";
import animeEntries from "./anime.generated.json";
import popularEntries from "./popular.generated.json";

/**
 * Titles produced by the metadata pipeline rather than written by hand.
 * `catalog.generated.json` comes from scripts/sync-catalog.mjs (Cinemeta),
 * `anime.generated.json` from TMDB's Japanese-animation discovery endpoints.
 */
type Entry = {
  slug: string;
  tmdbId: number;
  imdbId?: string;
  anilistId?: number;
  kind: "movie" | "series";
  name: string;
  year: number;
  runtime?: number;
  seasons?: number;
  genres: string[];
  rating: number;
  overview: string;
  creator?: string;
  cast?: string[];
  badge?: string;
  featured?: boolean;
  original?: boolean;
  anime?: boolean;
  posterPath?: string;
  backdropPath?: string;
};

const allowed: Genre[] = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "War",
  "Western",
];

const accents = [
  "#8b1e3f",
  "#1f4e79",
  "#3c2a4d",
  "#7a3b12",
  "#125c56",
  "#5c1a1a",
  "#2f4858",
  "#4a3b2a",
];

function hash(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

function maturityFor(entry: Entry) {
  if (entry.kind === "series") return entry.genres.includes("Horror") ? "TV-MA" : "TV-14";
  if (entry.genres.includes("Family") || entry.genres.includes("Animation")) return "PG";
  if (entry.genres.includes("Horror")) return "18+";
  return "16+";
}

const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const TMDB_BG = "https://image.tmdb.org/t/p/w780";

/** Artwork: TMDB paths when we have them, otherwise the IMDb CDN by id. */
export const generatedArt: Record<string, { poster: string; backdrop: string }> = Object.fromEntries(
  (entries as Entry[]).map((e) => [
    e.slug,
    {
      poster: e.posterPath
        ? `${TMDB_IMG}${e.posterPath}`
        : `https://images.metahub.space/poster/medium/${e.imdbId}/img`,
      backdrop: e.backdropPath
        ? `${TMDB_BG}${e.backdropPath}`
        : `https://images.metahub.space/background/medium/${e.imdbId}/img`,
    },
  ]),
);

const allEntries: Entry[] = [
  ...(entries as Entry[]),
  ...(popularEntries as Entry[]),
  ...(animeEntries as Entry[]).map((entry) => ({ ...entry, anime: true })),
];

/* artwork for every generated title, keyed by slug */
for (const entry of allEntries) {
  generatedArt[entry.slug] = {
    poster: entry.posterPath
      ? `${TMDB_IMG}${entry.posterPath}`
      : `https://images.metahub.space/poster/medium/${entry.imdbId}/img`,
    backdrop: entry.backdropPath
      ? `${TMDB_BG}${entry.backdropPath}`
      : entry.posterPath
        ? `${TMDB_BG}${entry.posterPath}`
        : `https://images.metahub.space/background/medium/${entry.imdbId}/img`,
  };
}

export const generatedTitles: Title[] = allEntries.map((entry) => {
  const genres = entry.genres.filter((g): g is Genre => (allowed as string[]).includes(g));
  const seasonCount = entry.kind === "series" ? (entry.seasons ?? 1) : undefined;
  const isAnime =
    Boolean(entry.anime) ||
    Boolean(entry.anilistId) ||
    (entry.genres.includes("Animation") && entry.kind === "series");
  return {
    slug: entry.slug,
    tmdbId: entry.tmdbId,
    anilistId: entry.anilistId,
    anime: isAnime,
    kind: entry.kind,
    name: entry.name,
    year: entry.year,
    genres: genres.length ? genres : ["Drama"],
    maturity: maturityFor(entry),
    seasons: seasonCount,
    runtime: entry.kind === "movie" ? (entry.runtime ?? 110) : undefined,
    rating: entry.rating,
    match: Math.min(99, Math.round(entry.rating * 10) + 4),
    tagline: entry.kind === "series" ? "Stream the whole story." : "Now streaming.",
    overview: entry.overview,
    creator: entry.creator ?? (isAnime ? "Japanese animation" : "NOFLIX"),
    cast: entry.cast ?? [],
    badge: entry.badge,
    accent: accents[hash(entry.slug) % accents.length],
    featured: entry.featured,
    original: entry.original,
    format: entry.kind === "series" ? `${seasonCount} Season${seasonCount === 1 ? "" : "s"}` : "Film",
  } satisfies Title;
});
