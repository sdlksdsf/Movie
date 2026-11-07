/**
 * The TMDB credential, baked in.
 *
 * The site ships with a working key so nobody is ever asked to paste one.
 * `NEXT_PUBLIC_TMDB_KEY` still wins if it is set at build time (useful for a
 * deployment that wants to rotate credentials), and a key typed into the old
 * settings box still takes precedence at runtime — but the fallback below is
 * what makes trailers, episode stills and the live shelves work out of the box.
 */
export const BAKED_TMDB_KEY = "18b99b7ed74f1f6407089a3471cd6e5a";

export const TMDB_API_KEY = (process.env.NEXT_PUBLIC_TMDB_KEY ?? "").trim() || BAKED_TMDB_KEY;

/** TMDB accepts a v3 key (32 chars) or a v4 read token (JWT starting `eyJ`). */
export const isBearerToken = (key: string) => key.trim().startsWith("eyJ");
