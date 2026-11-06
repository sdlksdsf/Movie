import type { Genre, Title } from "@/lib/types";
import entries from "./catalog.generated.json";

/**
 * Titles that came out of the metadata pipeline (`scripts/sync-catalog.mjs`)
 * instead of being written by hand. Every record carries a verified TMDB id and
 * an IMDb id, so both the player and the artwork resolve without guessing.
 */
type Entry = {
  slug: string;
  tmdbId: number;
  imdbId: string;
  kind: "movie" | "series";
  name: string;
  year: number;
  runtime?: number;
  seasons?: number;
  genres: string[];
  rating: number;
  overview: string;
  creator: string;
  cast: string[];
  badge?: string;
  featured?: boolean;
  original?: boolean;
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

/** Poster art straight from IMDb's image CDN, resolved through the Metahub cache. */
export const generatedArt: Record<string, { poster: string; backdrop: string }> = Object.fromEntries(
  (entries as Entry[]).map((e) => [
    e.slug,
    {
      poster: `https://images.metahub.space/poster/medium/${e.imdbId}/img`,
      backdrop: `https://images.metahub.space/background/medium/${e.imdbId}/img`,
    },
  ]),
);

export const generatedTitles: Title[] = (entries as Entry[]).map((entry) => {
  const genres = entry.genres.filter((g): g is Genre => (allowed as string[]).includes(g));
  const seasonCount = entry.kind === "series" ? (entry.seasons ?? 1) : undefined;
  return {
    slug: entry.slug,
    tmdbId: entry.tmdbId,
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
    creator: entry.creator,
    cast: entry.cast,
    badge: entry.badge,
    accent: accents[hash(entry.slug) % accents.length],
    featured: entry.featured,
    original: entry.original,
    format: entry.kind === "series" ? `${seasonCount} Season${seasonCount === 1 ? "" : "s"}` : "Film",
  } satisfies Title;
});
