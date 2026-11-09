import { NextResponse } from "next/server";
import { resolveStreams } from "@/lib/stream-resolver";
import { proxied } from "@/lib/stream-sign";

export const dynamic = "force-dynamic";

/**
 * GET /api/stream?tmdb=155&kind=movie&season=1&episode=1
 *
 * Resolves the actual HLS/MP4 a title lives on, so NOFLIX can play it in its
 * own player. Every URL is rewritten through /api/hls (signed), because the
 * CDNs check Referer/Origin and browsers cannot set those cross-origin.
 *
 * `ok: false` is a normal answer — the player then falls back to the embeds.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tmdbId = Number(searchParams.get("tmdb"));
  const kind = searchParams.get("kind") === "series" ? "series" : "movie";
  const season = Math.max(Number(searchParams.get("season") ?? 1) || 1, 1);
  const episode = Math.max(Number(searchParams.get("episode") ?? 1) || 1, 1);

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ ok: false, reason: "bad-id", sources: [] }, { status: 400 });
  }

  try {
    const result = await resolveStreams({ tmdbId, kind, season, episode });

    if (!result.sources.length) {
      return NextResponse.json(
        { ok: false, reason: "no-sources", sources: [] },
        { headers: { "cache-control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        provider: result.provider,
        expiresIn: result.expiresIn,
        count: result.sources.length,
        sources: result.sources.map((source) => ({
          provider: source.provider,
          label: source.label,
          quality: source.quality,
          type: source.type,
          url: proxied(source.url, source.referer),
        })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, reason: "resolver-error", sources: [] },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
