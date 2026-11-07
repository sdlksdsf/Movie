/**
 * Trailer lookup.
 *
 * Every catalogue title carries a TMDB id, and TMDB exposes the official
 * YouTube trailer/teaser for it. We resolve it in the browser (the API is
 * CORS-open), cache the answer for the session, and fall back silently when a
 * title has nothing usable — the poster artwork simply stays put.
 */

import { TMDB_API_KEY } from "@/lib/tmdb-key";

const ENDPOINT = "https://api.themoviedb.org/3";

const apiKey = () => TMDB_API_KEY;

type Video = {
  id: string;
  key?: string;
  site?: string;
  type?: string;
  official?: boolean;
  name?: string;
  published_at?: string;
  iso_639_1?: string;
};

const memory = new Map<number, string | null>();
const memoryList = new Map<number, string[]>();

function score(video: Video) {
  const type = (video.type ?? "").toLowerCase();
  let total = 0;
  if (type === "trailer") total += 40;
  else if (type === "teaser") total += 26;
  else if (type === "clip") total += 6;
  else if (type === "featurette") total += 3;
  else if (type === "opening credits" || type === "behind the scenes") total += 1;
  else total += 1;

  if (video.official) total += 12;
  const name = (video.name ?? "").toLowerCase();
  if (name.includes("official")) total += 6;
  if (name.includes("trailer")) total += 4;
  if (video.iso_639_1 === "en") total += 3;
  if (name.includes("final")) total -= 2;
  if (video.published_at) total += 1;
  return total;
}

async function request(url: string): Promise<Video[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6500);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: Video[] };
    return Array.isArray(json.results) ? json.results : [];
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}

function rank(videos: Video[]): string[] {
  const seen = new Set<string>();
  return videos
    .filter((v) => (v.site ?? "YouTube") === "YouTube" && typeof v.key === "string" && v.key.length === 11)
    .map((v) => ({ key: v.key as string, rank: score(v) }))
    .filter((entry) => entry.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .map((entry) => entry.key)
    .filter((key) => (seen.has(key) ? false : (seen.add(key), true)));
}

/**
 * Last-resort lookup: TMDB sometimes has no videos at all, but the IMDb id
 * usually does through Cinemeta — which is exactly why a handful of titles
 * "had no trailer".
 */
async function cinemetaTrailer(tmdbId: number, kind: "movie" | "series"): Promise<string[]> {
  const path = kind === "movie" ? "movie" : "tv";
  const ids = await requestJson(
    `${ENDPOINT}/${path}/${tmdbId}/external_ids?api_key=${apiKey()}`,
  ) as { imdb_id?: string } | null;
  const imdb = ids?.imdb_id;
  if (!imdb) return [];
  const meta = (await requestJson(`https://v3-cinemeta.strem.io/meta/${path}/${imdb}.json`)) as
    | { meta?: { trailerStreams?: Array<{ ytId?: string }>; trailers?: Array<{ source?: string }> } }
    | null;
  const streams = meta?.meta?.trailerStreams ?? [];
  const keys = streams
    .map((stream) => stream.ytId)
    .filter((id): id is string => typeof id === "string" && id.length === 11);
  return Array.from(new Set(keys)).slice(0, 2);
}

async function requestJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6500);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * The best trailer key for a TMDB title, or null.
 * Results (including "nothing found") are memoised per browser session.
 */
export async function findTrailerList(
  tmdbId: number,
  kind: "movie" | "series",
): Promise<string[]> {
  if (!tmdbId) return [];
  const cached = memoryList.get(tmdbId);
  if (cached) return cached;

  const cacheKey = `nf.trailer.list.${tmdbId}`;
  try {
    const cached = window.sessionStorage.getItem(cacheKey);
    if (cached !== null) {
      const value = cached ? (JSON.parse(cached) as string[]) : [];
      memoryList.set(tmdbId, value);
      return value;
    }
  } catch {
    /* private mode — just fetch */
  }

  const path = kind === "movie" ? "movie" : "tv";
  let keys = rank(await request(`${ENDPOINT}/${path}/${tmdbId}/videos?api_key=${apiKey()}`));

  /* some anime only expose their trailer on the movie record */
  if (keys.length === 0) {
    const otherPath = path === "tv" ? "movie" : "tv";
    keys = rank(await request(`${ENDPOINT}/${otherPath}/${tmdbId}/videos?api_key=${apiKey()}`));
  }

  if (keys.length === 0) keys = await cinemetaTrailer(tmdbId, kind);

  keys = keys.slice(0, 3);
  memoryList.set(tmdbId, keys);
  if (keys[0]) memory.set(tmdbId, keys[0]);
  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(keys));
  } catch {
    /* ignore */
  }
  return keys;
}

/** The best trailer key for a TMDB title, or null. */
export async function findTrailer(tmdbId: number, kind: "movie" | "series"): Promise<string | null> {
  const list = await findTrailerList(tmdbId, kind);
  return list[0] ?? null;
}

export function trailerEmbedUrl(videoId: string, origin: string, unmuted = false) {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: unmuted ? "0" : "1",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3",
    playsinline: "1",
    loop: "1",
    playlist: videoId,
    enablejsapi: "1",
    disablekb: "1",
    fs: "0",
  });
  if (origin) params.set("origin", origin);
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
