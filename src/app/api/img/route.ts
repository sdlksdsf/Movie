import { NextResponse } from "next/server";
import { TMDB_API_KEY, isBearerToken } from "@/lib/tmdb-key";

/**
 * GET /api/img?u=<artwork url>&alt=<backup url>
 *
 * Poster and backdrop proxy.
 *
 * Artwork used to be loaded straight from image.tmdb.org / images.metahub.space
 * by the visitor's browser. Two things went wrong with that: a host that
 * *hangs* (rather than erroring) leaves the <img> in limbo — no `load`, no
 * `error`, so the tile stays invisible forever — and a host blocked at the
 * visitor's ISP takes the art down with it. Both are solved by fetching the
 * bytes here, with a hard timeout, and serving them from our own origin.
 *
 * `alt` is tried when `u` fails, so a title with both a TMDB path and an IMDb
 * id still has a second chance before the UI falls back to its gradient plate.
 *
 * `?tmdb=<id>&kind=poster|backdrop` resolves artwork from TMDB by id instead.
 * That is the most dependable path — several bundled titles only carried an
 * IMDb id, so their art came from a third-party CDN that is often down; TMDB
 * almost always has a real still for the same title.
 */

const ALLOWED_HOSTS = new Set([
  "image.tmdb.org",
  "images.metahub.space",
  "www.themoviedb.org",
  "themoviedb.org",
]);

/** Six seconds is plenty for a CDN edge, and short enough to fail visibly. */
const TIMEOUT_MS = 6000;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

/** resolved TMDB artwork paths, kept for a day */
const resolved = new Map<string, { at: number; path: string | null }>();
const DAY = 86_400_000;

function tmdbKey(): string {
  return (
    process.env.TMDB_API_KEY ??
    process.env.NEXT_PUBLIC_TMDB_API_KEY ??
    TMDB_API_KEY ??
    ""
  ).trim();
}

async function fromTmdb(id: string, kind: "poster" | "backdrop"): Promise<string | null> {
  if (!/^\d+$/.test(id)) return null;
  const cacheKey = `${kind}:${id}`;
  const hit = resolved.get(cacheKey);
  if (hit && Date.now() - hit.at < DAY) return hit.path;

  const credential = tmdbKey();
  if (!credential) return null;
  const bearer = isBearerToken(credential);

  for (const type of ["movie", "tv"]) {
    const url = new URL(`https://api.themoviedb.org/3/${type}/${id}`);
    url.searchParams.set("language", "en-US");
    if (!bearer) url.searchParams.set("api_key", credential);
    try {
      const res = await fetch(url, {
        headers: bearer ? { authorization: `Bearer ${credential}` } : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate: DAY / 1000 },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        poster_path?: string | null;
        backdrop_path?: string | null;
      };
      const path = kind === "poster" ? data.poster_path : data.backdrop_path ?? data.poster_path;
      if (path) {
        const full = `https://image.tmdb.org/t/p/${kind === "poster" ? "w500" : "w1280"}${path}`;
        resolved.set(cacheKey, { at: Date.now(), path: full });
        return full;
      }
    } catch {
      /* try the other media type */
    }
  }
  resolved.set(cacheKey, { at: Date.now(), path: null });
  return null;
}

function parse(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!ALLOWED_HOSTS.has(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function grab(target: string): Promise<Response | null> {
  try {
    const upstream = await fetch(target, {
      headers: { "user-agent": UA, accept: "image/avif,image/webp,image/*,*/*" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      /* artwork never changes for a given id — let the CDN keep it a week */
      next: { revalidate: 604_800 },
    });
    if (!upstream.ok || !upstream.body) return null;
    const type = upstream.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    return new NextResponse(upstream.body, {
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400",
        "x-artwork-source": new URL(target).hostname,
      },
    });
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") === "poster" ? "poster" : "backdrop";
  const byId = searchParams.get("tmdb");
  const candidates = [
    byId ? await fromTmdb(byId, kind) : null,
    parse(searchParams.get("u")),
    parse(searchParams.get("alt")),
  ].filter((value): value is string => Boolean(value));

  const probe = searchParams.get("probe") === "1";

  for (const candidate of candidates) {
    const hit = await grab(candidate);
    if (hit) {
      if (!probe) return hit;
      return NextResponse.json({
        ok: true,
        source: hit.headers.get("x-artwork-source"),
        resolved: candidates,
        contentType: hit.headers.get("content-type"),
      });
    }
  }

  if (probe) {
    return NextResponse.json({ ok: false, resolved: candidates, allowed: [...ALLOWED_HOSTS] });
  }

  /* a short cache: a hiccup on the CDN should be retried soon, not remembered */
  return new NextResponse(null, {
    status: 404,
    headers: { "cache-control": "public, max-age=60" },
  });
}
