import { verifyStream, proxied } from "@/lib/stream-sign";
import { refererAllowed } from "@/lib/stream-resolver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MANIFEST_MAGIC = "#EXTM3U";

type Sniffed =
  | { kind: "manifest"; body: string }
  | { kind: "stream"; stream: ReadableStream<Uint8Array> | null };

/**
 * Peek at the first bytes instead of trusting the URL extension or the
 * content-type: provider CDNs happily serve `master.m3u8` as
 * `application/octet-stream` from a path with no extension. If it is a
 * manifest we buffer and rewrite it; otherwise the untouched stream is handed
 * back so segments keep streaming without a full buffer in memory.
 */
async function sniff(upstream: Response): Promise<Sniffed> {
  if (!upstream.body) return { kind: "stream", stream: null };

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  let head = "";
  let done = false;

  try {
    while (head.length < MANIFEST_MAGIC.length && !done) {
      const read = await reader.read();
      done = read.done;
      if (read.value) {
        chunks.push(read.value);
        head += decoder.decode(read.value, { stream: true });
      }
    }
  } catch {
    return { kind: "stream", stream: null };
  }

  const rebuilt = () =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
      },
      async pull(controller) {
        try {
          const read = await reader.read();
          if (read.done) {
            controller.close();
            return;
          }
          controller.enqueue(read.value);
        } catch (error) {
          controller.error(error);
        }
      },
      cancel(reason) {
        void reader.cancel(reason);
      },
    });

  if (!head.replace(/^\uFEFF/, "").trimStart().startsWith(MANIFEST_MAGIC)) {
    return { kind: "stream", stream: done ? null : rebuilt() };
  }

  /* it *is* a manifest: read the rest and hand back the whole playlist */
  while (!done) {
    const read = await reader.read();
    done = read.done;
    if (read.value) {
      chunks.push(read.value);
      head += decoder.decode(read.value, { stream: true });
    }
  }
  return { kind: "manifest", body: head };
}

/**
 * GET /api/hls?u=<url>&r=<referer>&e=<expiry>&s=<signature>
 *
 * A tiny, signed HLS proxy: it replays the Referer/Origin a CDN expects,
 * rewrites every URI inside a manifest so child playlists, keys and segments
 * come back through here too, and streams segments straight through with Range
 * support.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("u") ?? "";
  const referer = searchParams.get("r") ?? "";
  const signature = searchParams.get("s") ?? "";
  const expiresAt = Number(searchParams.get("e") ?? 0);

  if (!target || !referer || !signature || !expiresAt) {
    return new Response("missing parameters", { status: 400 });
  }
  if (!verifyStream(target, referer, signature, expiresAt) || !refererAllowed(referer)) {
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
    upstream = await fetch(url.toString(), {
      headers,
      cache: "no-store",
      redirect: "follow",
    });
  } catch {
    return new Response("upstream unreachable", { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`upstream ${upstream.status}`, { status: 502 });
  }

  const contentType = (upstream.headers.get("content-type") ?? "").toLowerCase();
  const isSegmentRequest = Boolean(range) || upstream.status === 206;

  if (!isSegmentRequest) {
    let sniffed: Sniffed;
    try {
      sniffed = await sniff(upstream);
    } catch {
      return new Response("upstream unreadable", { status: 502 });
    }

    if (sniffed.kind === "manifest") {
      const absolute = (uri: string) => {
        try {
          return new URL(uri, url).toString();
        } catch {
          return uri;
        }
      };

      const sign = (uri: string) => proxied(absolute(uri), referer, expiresAt);

      const rewritten = sniffed.body
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          if (trimmed.startsWith("#")) {
            return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${sign(uri)}"`);
          }
          return sign(trimmed);
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
      "cache-control": "public, max-age=600, s-maxage=3600",
      "access-control-allow-origin": "*",
    });
    const length = upstream.headers.get("content-length");
    if (length) passthrough.set("content-length", length);

    return new Response(sniffed.stream, { status: upstream.status, headers: passthrough });
  }

  const passthrough = new Headers({
    "content-type": contentType || "application/octet-stream",
    "accept-ranges": upstream.headers.get("accept-ranges") ?? "bytes",
    "cache-control": "public, max-age=600, s-maxage=3600",
    "access-control-allow-origin": "*",
  });
  const length = upstream.headers.get("content-length");
  if (length) passthrough.set("content-length", length);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) passthrough.set("content-range", contentRange);

  return new Response(upstream.body, { status: upstream.status, headers: passthrough });
}
