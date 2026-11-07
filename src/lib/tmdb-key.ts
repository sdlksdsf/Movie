/**
 * The TMDB credential.
 *
 * The key is supplied by the deployment (Vercel environment variable
 * `NEXT_PUBLIC_TMDB_KEY`) so no credential is committed to this repository.
 * Nothing in the UI ever asks a visitor for a key — if one is missing the app
 * simply falls back to its bundled catalogue and hides the live rows.
 */

export const TMDB_API_KEY = (process.env.NEXT_PUBLIC_TMDB_KEY ?? "").trim();

/** True when a TMDB credential is available for live shelves and trailers. */
export const hasTmdbKey = Boolean(TMDB_API_KEY);

/** TMDB accepts a v3 key (32 chars) or a v4 read token (JWT starting `eyJ`). */
export const isBearerToken = (key: string) => key.trim().startsWith("eyJ");
