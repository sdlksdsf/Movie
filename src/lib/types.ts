export type Kind = "movie" | "series";

export type Genre =
  | "Action"
  | "Adventure"
  | "Animation"
  | "Comedy"
  | "Crime"
  | "Documentary"
  | "Drama"
  | "Family"
  | "Fantasy"
  | "History"
  | "Horror"
  | "Music"
  | "Mystery"
  | "Romance"
  | "Sci-Fi"
  | "Thriller"
  | "War"
  | "Western";

export type Title = {
  /** URL-safe unique id, also used for the artwork filename */
  slug: string;
  /** The Movie Database id — powers the player embeds */
  tmdbId: number;
  /** AniList id — used by the embed's dedicated anime route */
  anilistId?: number;
  /** anime gets its own shelf, page and route */
  anime?: boolean;
  kind: Kind;
  name: string;
  year: number;
  genres: Genre[];
  /** e.g. TV-MA, PG-13, 16+ */
  maturity: string;
  /** fractional seasons (e.g. 1.5) are not used — whole numbers only */
  seasons?: number;
  /** runtime in minutes, movies only */
  runtime?: number;
  /** 0 – 10 */
  rating: number;
  /** 0 – 100 "match" score shown next to the play button */
  match: number;
  tagline: string;
  overview: string;
  creator: string;
  cast: string[];
  /** small red pill above the title (e.g. "New Season") */
  badge?: string;
  /** leads each row / card colour grading */
  accent: string;
  /** appears in the hero billboard rotation */
  featured?: boolean;
  /** position in the top-10 list (1 = #1) */
  top10?: number;
  /** NOFLIX Original styling */
  original?: boolean;
  /** small descriptor used by the player ("Limited Series", "Film", …) */
  format: string;
};

export type Row = {
  id: string;
  title: string;
  slugs: string[];
  /** renders the giant rank numerals behind the cards */
  ranked?: boolean;
  /** shows an episode progress bar under the card */
  continueWatching?: boolean;
  /** sub-label shown next to the row heading */
  hint?: string;
};

export type Episode = {
  number: number;
  name: string;
  runtime: number;
  overview: string;
};

export type Season = {
  number: number;
  year: number;
  episodes: Episode[];
};
