import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signing for the HLS proxy.
 *
 * The proxy fetches third-party manifests and segments on the viewer's behalf,
 * because those CDNs check `Referer`/`Origin` — headers a browser refuses to
 * set on a cross-origin XHR. Nothing but a URL we signed can pass through, and
 * every signature expires, so the endpoint can't be used as an open proxy.
 *
 * Server-only: never import this from a client component.
 */

/** How long one resolved stream stays playable (a film is comfortably inside). */
export const STREAM_TTL_MS = 6 * 60 * 60 * 1000;

const SECRET =
  process.env.HLS_PROXY_SECRET ??
  process.env.TMDB_API_KEY ??
  process.env.NEXT_PUBLIC_TMDB_API_KEY ??
  process.env.NEXT_PUBLIC_TMDB_KEY ??
  "noflix-hls-v1";

const digest = (payload: string) =>
  createHmac("sha256", SECRET).update(payload).digest("base64url");

export function signStream(url: string, referer: string, expiresAt: number) {
  return digest(`${url}\n${referer}\n${expiresAt}`);
}

export function verifyStream(
  url: string,
  referer: string,
  signature: string,
  expiresAt: number,
) {
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  const expected = signStream(url, referer, expiresAt);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The same-origin URL the video element or hls.js should request. */
export function proxied(url: string, referer: string, expiresAt = Date.now() + STREAM_TTL_MS) {
  const params = new URLSearchParams({
    u: url,
    r: referer,
    e: String(expiresAt),
    s: signStream(url, referer, expiresAt),
  });
  return `/api/hls?${params.toString()}`;
}
