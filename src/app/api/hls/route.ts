import { verifyStream, proxied } from "@/lib/stream-sign";
import { refererAllowed } from "@/lib/stream-resolver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * GET /api/hls?u=<url>&r=<referer>&s=<signature>
 *
 * A tiny, signed HLS proxy: it replays the Referer/Origin a CDN expects,
 * rewrites every URI inside a manifest so child playlists, keys and segments
 * come back through here too, and streams segments straight through with Range
 * support. Only URLs we signed can be fetched, so it is not an open proxy.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("u") ?? "";
  const referer = searchParams.get("r") ?? "";
  const signature = searchParams.get("s") ?? "";

  if (!target || !referer || !signature) {
    return new Response("missing parameters", { status: 400 });
  }
  if (!verifyStream(target, referer, signature) || !refererAllowed(referer)) {
    return new Response("forbidden", { status: 403 });
  }

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return new Response("bad protocol", { status: 400 });
  }

  const range = request.headers.get("range");
  const headers: Record<string, string> = {
    "user-agent": UA,
    referer,
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
  };
  try {
    headers.origin = new URL(referer).origin;
  } catch {
    /* referer already validated */
  }
  if (range) headers.range = range;

  let upstream: Response;
  try {
    upstream = await fetch(url.toString(), { headers, cache: "no-store", redirect: "follow" });
  } catch {
    return new Response("upstream unreachable", { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`upstream ${upstream.status}`, { status: 502 });
  }

  const contentType = (upstream.headers.get("content-type") ?? "").toLowerCase();
  const looksLikeManifest =
    /\.m3u8(\?|$)/i.test(url.pathname) ||
    contentType.includes("mpegurl") ||
    contentType.includes("m3u");

  if (looksLikeManifest) {
    const body = await upstream.text();
    if (!body.includes("#EXTM3U")) {
      /* some hosts answer 200 with an HTML error page — treat it as a miss */
      return new Response("not a manifest", { status: 502 });
    }

    const absolute = (uri: string) => {
      try {
        return new URL(uri, url).toString();
      } catch {
        return uri;
      }
    };

    const rewritten = body
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (trimmed.startsWith("#")) {
          return line.replace(/URI="([^"]+)"/g, (_, uri: string) => `URI="${proxied(absolute(uri), referer)}"`);
        }
        return proxied(absolute(trimmed), referer);
      })
      .join("\n");

    return new Response(rewritten, {
      status: 200,
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    });
  }

  const passthrough = new Headers({
    "content-type": contentType || "application/octet-stream",
    "accept-ranges": upstream.headers.get("accept-ranges") ?? "bytes",
    "cache-control": "private, max-age=3600",
    "access-control-allow-origin": "*",
  });
  const length = upstream.headers.get("content-length");
  if (length) passthrough.set("content-length", length);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) passthrough.set("content-range", contentRange);

  return new Response(upstream.body, { status: upstream.status, headers: passthrough });
}
