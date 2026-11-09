import { NextResponse } from "next/server";
import { resolveStreams } from "@/lib/stream-resolver";
import { GET as hls } from "@/app/api/hls/route";

/**
 * TEMPORARY end-to-end self test (removed before this round ships).
 *
 * Runs the exact chain a browser runs, but from the server so we can see the
 * status codes and headers instead of guessing:
 *   source URL  →  master playlist  →  child playlist  →  first segment
 * once direct (what <video>/hls.js does from the viewer's IP) and once through
 * /api/hls (what our relay does).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const printable = (value: string) =>
  value.replace(/[^\x20-\x7E]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);

type Step = {
  label: string;
  status?: number;
  contentType?: string | null;
  cors?: string | null;
  bytes?: number;
  head?: string;
  uris?: number;
  error?: string;
  text?: string;
};

async function direct(
  url: string,
  referer?: string,
  extra: Record<string, string> = {},
  label = "direct",
): Promise<Step & { body?: string }> {
  try {
    const headers: Record<string, string> = { "user-agent": UA, accept: "*/*", ...extra };
    if (referer) headers.referer = referer;
    const res = await fetch(url, { headers, cache: "no-store" });
    const buffer = Buffer.from(await res.arrayBuffer());
    const first = buffer.subarray(0, 4);
    const sniff = buffer.subarray(0, 64).toString("latin1");
    return {
      label,
      status: res.status,
      contentType: res.headers.get("content-type"),
      cors: res.headers.get("access-control-allow-origin"),
      bytes: buffer.length,
      head: printable(res.ok ? sniff : buffer.subarray(0, 300).toString("utf8")),
      /* 0x47 = MPEG-TS sync byte; "ftyp"/"styp" = fMP4 */
      body: first[0] === 0x47 || /ftyp|styp|moof/.test(sniff) ? "video" : printable(sniff).slice(0, 40),
    };
  } catch (error) {
    return { label: "direct", error: String(error).slice(0, 120) };
  }
}

async function relay(url: string, referer: string): Promise<Step & { body?: string; text?: string }> {
  try {
    const target = new URL("https://noflix.local/api/hls");
    target.searchParams.set("u", url);
    target.searchParams.set("r", referer);
    /* sign it the same way /api/stream does, by asking the helper directly */
    const { proxied } = await import("@/lib/stream-sign");
    const signed = proxied(url, referer);
    const res = await hls(new Request(`https://noflix.local${signed}`));
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = buffer.toString("utf8");
    const manifest = text.includes("#EXTM3U");
    return {
      label: "relay",
      status: res.status,
      contentType: res.headers.get("content-type"),
      bytes: buffer.length,
      head: printable(text.slice(0, 120)),
      uris: manifest ? text.split("\n").filter((line) => line && !line.startsWith("#")).length : 0,
      body: manifest ? "manifest" : buffer[0] === 0x47 || /ftyp|styp|moof/.test(text.slice(0, 64)) ? "video" : printable(text).slice(0, 40),
      text: manifest ? text : undefined,
    };
  } catch (error) {
    return { label: "relay", error: String(error).slice(0, 160) };
  }
}

const uris = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

export async function GET(request: Request) {
  const tmdb = Number(new URL(request.url).searchParams.get("tmdb") ?? 155);
  const kind = new URL(request.url).searchParams.get("kind") === "series" ? "series" : "movie";

  const resolved = await resolveStreams({ tmdbId: tmdb, kind, season: 1, episode: 1 });
  const report: Record<string, unknown> = {
    count: resolved.sources.length,
    providers: resolved.sources.map((source) => `${source.provider}:${source.quality ?? "?"}:${source.codec}`),
  };

  const hlsSource = resolved.sources.find((source) => source.type === "hls");
  const mp4Source = resolved.sources.find((source) => source.type === "mp4");

  const only = new URL(request.url).searchParams.get("only");

  if (hlsSource) {
    const steps: Step[] = [];
    const browserHeaders = {
      origin: "https://noflix-taupe.vercel.app",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "cross-site",
    };
    steps.push(await direct(hlsSource.url, undefined, {}, "no-referer"));
    steps.push(await direct(hlsSource.url, hlsSource.referer, {}, "provider-referer"));
    steps.push(
      await direct(
        hlsSource.url,
        "https://noflix-taupe.vercel.app/",
        browserHeaders,
        "browser (our origin)",
      ),
    );
    const master = await relay(hlsSource.url, hlsSource.referer);
    steps.push({ ...master, text: undefined });

    const child = master.text ? uris(master.text)[0] : null;
    if (child) {
      /* the relay hands back a signed same-origin URL; unwrap it for a direct test */
      const inner = new URL(`https://noflix.local${child}`).searchParams.get("u");
      if (inner) steps.push(await direct(inner, undefined, {}, "child no-referer"));
      if (inner)
        steps.push(
          await direct(inner, "https://noflix-taupe.vercel.app/", browserHeaders, "child browser"),
        );
      const childRelay = await relay(inner ?? "", hlsSource.referer);
      steps.push({ ...childRelay, text: undefined });

      const segment = childRelay.text ? uris(childRelay.text)[0] : null;
      if (segment) {
        const segmentUrl = new URL(`https://noflix.local${segment}`).searchParams.get("u");
        if (segmentUrl) {
          steps.push(await direct(segmentUrl, undefined, {}, "segment no-referer"));
          steps.push(
            await direct(
              segmentUrl,
              "https://noflix-taupe.vercel.app/",
              { ...browserHeaders, range: "bytes=0-" },
              "segment browser+range",
            ),
          );
          steps.push(
            await direct(segmentUrl, undefined, { range: "bytes=0-" }, "segment range only"),
          );
          steps.push(
            await direct(
              segmentUrl,
              "https://noflix-taupe.vercel.app/",
              browserHeaders,
              "segment browser no range",
            ),
          );
          steps.push(
            await direct(
              segmentUrl,
              "https://nextgencloudfabric.com/",
              { origin: "https://nextgencloudfabric.com", range: "bytes=0-" },
              "segment provider+range",
            ),
          );
        }
        steps.push({ ...(await relay(segmentUrl ?? "", hlsSource.referer)), text: undefined });
      }
    }
    report.hls = {
      provider: hlsSource.provider,
      steps: only === "segment" ? steps.filter((step) => step.label.startsWith("segment")) : steps,
    };
  }

  if (mp4Source) {
    report.mp4 = {
      provider: mp4Source.provider,
      steps: [await direct(mp4Source.url), await relay(mp4Source.url, mp4Source.referer)],
    };
  }

  return NextResponse.json(report, { headers: { "cache-control": "no-store" } });
}
