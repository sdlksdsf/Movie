/**
 * Trailer lookup.
 *
 * Every catalogue title carries a TMDB id, and TMDB exposes the official
 * YouTube trailer/teaser for it. We resolve it in the browser (the API is
 * CORS-open), cache the answer for the session, and fall back silently when a
 * title has nothing usable — the poster artwork simply stays put.
 */

const ENDPOINT = "https://api.themoviedb.org/3";

/** baked fallback so a trailer never depends on the visitor configuring a key */
const BAKED_KEY = "18b99b7ed74f1f6407089a3471cd6e5a";

function apiKey() {
  return process.env.NEXT_PUBLIC_TMDB_KEY || BAKED_KEY;
}

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

function score(video: Video) {
  const type = (video.type ?? "").toLowerCase();
  let total = 0;
  if (type === "trailer") total += 40;
  else if (type === "teaser") total += 26;
  else if (type === "clip") total += 6;
  else return -1;

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

function pick(videos: Video[]): string | null {
  const candidates = videos
    .filter((v) => v.site === "YouTube" && typeof v.key === "string" && v.key.length === 11)
    .map((v) => ({ video: v, rank: score(v) }))
    .filter((entry) => entry.rank > 0)
    .sort((a, b) => b.rank - a.rank);

  return candidates[0]?.video.key ?? null;
}

/**
 * The best trailer key for a TMDB title, or null.
 * Results (including "nothing found") are memoised per browser session.
 */
export async function findTrailer(tmdbId: number, kind: "movie" | "series"): Promise<string | null> {
  if (!tmdbId) return null;
  if (memory.has(tmdbId)) return memory.get(tmdbId) ?? null;

  const cacheKey = `nf.trailer.${tmdbId}`;
  try {
    const cached = window.sessionStorage.getItem(cacheKey);
    if (cached !== null) {
      const value = cached || null;
      memory.set(tmdbId, value);
      return value;
    }
  } catch {
    /* private mode — just fetch */
  }

  const path = kind === "movie" ? "movie" : "tv";
  let key = pick(await request(`${ENDPOINT}/${path}/${tmdbId}/videos?api_key=${apiKey()}`));

  /* some anime only expose their trailer on the movie record */
  if (!key) {
    const otherPath = path === "tv" ? "movie" : "tv";
    key = pick(await request(`${ENDPOINT}/${otherPath}/${tmdbId}/videos?api_key=${apiKey()}`));
  }

  memory.set(tmdbId, key);
  try {
    window.sessionStorage.setItem(cacheKey, key ?? "");
  } catch {
    /* ignore */
  }
  return key;
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
