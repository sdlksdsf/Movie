/**
 * Stream resolution.
 *
 * This is the piece that lets NOFLIX play video in its *own* player instead of
 * handing the viewer to someone else's iframe. Each provider is reverse
 * engineered from the public embed it serves: we ask it for the manifest it
 * would itself play, and hand that manifest to our own <video> element.
 *
 * Runs on the server only — the providers check `Referer`/`Origin`, which a
 * browser cannot forge. Every URL we return goes back out through /api/hls,
 * signed, so playback works from the browser without exposing these hosts.
 */

export type StreamSource = {
  provider: string;
  label: string;
  quality?: string;
  url: string;
  type: "hls" | "mp4";
  /** the Referer this CDN expects — the proxy replays it */
  referer: string;
};

export type StreamResult = {
  provider: string;
  sources: StreamSource[];
  expiresIn: number;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const TIMEOUT = 9000;

async function timed<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    return await run(controller.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function text(url: string, headers: Record<string, string>, signal: AbortSignal) {
  const res = await fetch(url, { headers, signal, cache: "no-store" });
  if (!res.ok) return null;
  return res.text();
}

async function json<T>(url: string, headers: Record<string, string>, signal: AbortSignal) {
  const body = await text(url, headers, signal);
  if (!body) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

const isHttp = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value);

const qualityRank = (quality?: string) => {
  if (!quality) return 0;
  const n = Number.parseInt(quality, 10);
  if (Number.isFinite(n)) return n;
  if (/4k/i.test(quality)) return 2160;
  return 0;
};

/* ------------------------------------------------------------------ vidlink */

type VidlinkQuality = { url?: string; type?: string };

type VidlinkResponse = {
  stream?: {
    qualities?: Record<string, VidlinkQuality>;
    playlist?: string;
    type?: string;
  };
  sources?: Array<{ url?: string; quality?: string }>;
};

/**
 * vidlink.pro → enc-dec.app encrypts the TMDB id, the API then answers with one
 * URL per quality (usually HLS, sometimes a plain MP4).
 */
async function vidlink(
  tmdbId: number,
  kind: "movie" | "series",
  season: number,
  episode: number,
): Promise<StreamResult | null> {
  const headers = { "user-agent": UA, referer: "https://vidlink.pro/" };

  const encrypted = await timed(async (signal) => {
    const data = await json<{ result?: string }>(
      `https://enc-dec.app/api/enc-vidlink?text=${encodeURIComponent(String(tmdbId))}`,
      { "user-agent": UA },
      signal,
    );
    return data?.result ?? null;
  });
  if (!encrypted) return null;

  const path =
    kind === "series"
      ? `https://vidlink.pro/api/b/tv/${encrypted}/${season}/${episode}?multiLang=0`
      : `https://vidlink.pro/api/b/movie/${encrypted}?multiLang=0`;

  const payload = await timed((signal) => json<VidlinkResponse>(path, headers, signal));
  if (!payload) return null;

  const sources: StreamSource[] = [];
  const qualities = payload.stream?.qualities ?? {};
  for (const [quality, entry] of Object.entries(qualities)) {
    if (!entry?.url) continue;
    const url = entry.url;
    sources.push({
      provider: "vidlink",
      label: "VidLink",
      quality: /^\d+$/.test(quality) ? `${quality}p` : quality === "4k" ? "4K" : quality,
      url,
      type: /\.mp4(\?|$)/i.test(url) ? "mp4" : "hls",
      referer: "https://vidlink.pro/",
    });
  }

  const playlist = payload.stream?.playlist;
  if (isHttp(playlist)) {
    sources.push({
      provider: "vidlink",
      label: "VidLink",
      quality: "auto",
      url: playlist,
      type: /\.mp4(\?|$)/i.test(playlist) ? "mp4" : "hls",
      referer: "https://vidlink.pro/",
    });
  }

  for (const entry of payload.sources ?? []) {
    if (!isHttp(entry?.url)) continue;
    sources.push({
      provider: "vidlink",
      label: "VidLink",
      quality: entry.quality ?? "auto",
      url: entry.url,
      type: /\.mp4(\?|$)/i.test(entry.url) ? "mp4" : "hls",
      referer: "https://vidlink.pro/",
    });
  }

  if (!sources.length) return null;

  sources.sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));
  return { provider: "vidlink", sources: dedupe(sources), expiresIn: 3600 };
}

/* ------------------------------------------------------------------- vixsrc */

const VIXSRC = "https://vixsrc.to";

/**
 * vixsrc → /api/{movie|tv} gives an embed path, the embed page carries a signed
 * token, and that token unlocks the master playlist.
 */
async function vixsrc(
  tmdbId: number,
  kind: "movie" | "series",
  season: number,
  episode: number,
): Promise<StreamResult | null> {
  const baseHeaders = {
    "user-agent": UA,
    accept: "application/json, text/html, */*",
    referer: `${VIXSRC}/`,
    origin: VIXSRC,
  };

  const apiUrl =
    kind === "series"
      ? `${VIXSRC}/api/tv/${tmdbId}/${season}/${episode}`
      : `${VIXSRC}/api/movie/${tmdbId}`;

  const embedPath = await timed(async (signal) => {
    const data = await json<{ src?: string }>(apiUrl, baseHeaders, signal);
    return typeof data?.src === "string" ? data.src : null;
  });
  if (!embedPath) return null;

  const html = await timed((signal) =>
    text(`${VIXSRC}${embedPath}`, { ...baseHeaders, accept: "text/html,*/*" }, signal),
  );
  if (!html) return null;

  const token = html.match(/token["']\s*:\s*["']([^"']+)/)?.[1];
  const expires = html.match(/expires["']\s*:\s*["']([^"']+)/)?.[1];
  const playlist = html.match(/url\s*:\s*["']([^"']+)/)?.[1];
  if (!token || !expires || !isHttp(playlist)) return null;

  const expiresAt = Number(expires) * 1000;
  if (Number.isFinite(expiresAt) && expiresAt - 60_000 < Date.now()) return null;

  const separator = playlist.includes("?") ? "&" : "?";
  const master = `${playlist}${separator}token=${token}&expires=${expires}&h=1`;

  const manifest = await timed((signal) =>
    text(master, { ...baseHeaders, referer: apiUrl }, signal),
  );
  if (!manifest || !manifest.includes("#EXTM3U")) return null;

  return {
    provider: "vixsrc",
    sources: [
      {
        provider: "vixsrc",
        label: "VixSrc",
        quality: bestVariant(manifest) ?? "auto",
        url: master,
        type: "hls",
        referer: apiUrl,
      },
    ],
    expiresIn: Math.max(
      60,
      Math.floor(((Number.isFinite(expiresAt) ? expiresAt : Date.now() + 3_600_000) - Date.now()) / 1000),
    ),
  };
}

/** Highest RESOLUTION= value inside an HLS master, as "1080p". */
function bestVariant(manifest: string) {
  let best = 0;
  for (const match of manifest.matchAll(/RESOLUTION=\d+x(\d+)/g)) {
    const height = Number(match[1]);
    if (Number.isFinite(height) && height > best) best = height;
  }
  return best ? `${best}p` : null;
}

function dedupe(sources: StreamSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

export type ResolveInput = {
  tmdbId: number;
  kind: "movie" | "series";
  season: number;
  episode: number;
};

/**
 * Ask every provider in parallel and return the first that produced something,
 * with the rest kept as alternatives the player can switch to without a reload.
 */
export async function resolveStreams(input: ResolveInput): Promise<{
  sources: StreamSource[];
  provider: string | null;
  expiresIn: number;
}> {
  const { tmdbId, kind, season, episode } = input;
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return { sources: [], provider: null, expiresIn: 0 };
  }

  const [a, b] = await Promise.all([
    vidlink(tmdbId, kind, season, episode),
    vixsrc(tmdbId, kind, season, episode),
  ]);

  const results = [a, b].filter((result): result is StreamResult => Boolean(result));
  if (!results.length) return { sources: [], provider: null, expiresIn: 0 };

  const sources = dedupe(results.flatMap((result) => result.sources));
  return {
    sources,
    provider: results[0].provider,
    expiresIn: Math.min(...results.map((result) => result.expiresIn)),
  };
}

/** Hosts we are willing to fetch through the proxy (defence in depth). */
const ALLOWED_REFERERS = [
  "vidlink.pro",
  "vixsrc.to",
  "vodvidl.site",
  "hakunaymatata.com",
  "storm.vodvidl.site",
];

export function refererAllowed(referer: string) {
  try {
    const host = new URL(referer).hostname;
    return ALLOWED_REFERERS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}
