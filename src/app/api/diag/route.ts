import { NextResponse } from "next/server";
import { refererAllowed } from "@/lib/stream-resolver";

/**
 * TEMPORARY diagnostics (removed once the player is verified).
 *
 * Server-side network is the only place with egress to the providers, so this
 * route lets us look at what a provider actually answers and what codec an MP4
 * really uses. Restricted to allow-listed referers so it is not an SSRF hole.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CODECS = ["avc1", "avc3", "hvc1", "hev1", "vp09", "av01", "mp4a", "ec-3", "ac-3", "moov", "ftyp"];

async function probe(url: string, referer: string, range: string) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, referer, origin: new URL(referer).origin, range },
    cache: "no-store",
  });
  const buffer = Buffer.from(await res.arrayBuffer());
  const latin = buffer.toString("latin1");
  const found: Record<string, number[]> = {};
  for (const codec of CODECS) {
    const hits: number[] = [];
    let index = latin.indexOf(codec);
    while (index !== -1 && hits.length < 4) {
      hits.push(index);
      index = latin.indexOf(codec, index + 1);
    }
    if (hits.length) found[codec] = hits;
  }
  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    contentLength: res.headers.get("content-length"),
    contentRange: res.headers.get("content-range"),
    received: buffer.length,
    boxes: found,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  /* 1. what does an mp4 actually contain? */
  const target = searchParams.get("mp4");
  const referer = searchParams.get("referer");

  /* 2. what does the vixsrc embed page really serve? */
  const vixsrcId = searchParams.get("vixsrc");
  const kind = searchParams.get("kind") === "series" ? "series" : "movie";
  const season = searchParams.get("season") ?? "1";
  const episode = searchParams.get("episode") ?? "1";

  const headers = {
    "user-agent": UA,
    referer: "https://vixsrc.to/",
    origin: "https://vixsrc.to",
    accept: "application/json, text/html, */*",
    "accept-language": "en-US,en;q=0.9",
  };

  if (target) {
    if (!referer || !refererAllowed(referer)) {
      return NextResponse.json({ error: "referer not allowed" }, { status: 400 });
    }
    const head = await probe(target, referer, "bytes=0-262143");
    const tail = await probe(target, referer, "bytes=-131072");
    return NextResponse.json({ head, tail });
  }

  if (!vixsrcId) {
    return NextResponse.json({ error: "pass ?mp4=&referer= or ?vixsrc=" }, { status: 400 });
  }

  const apiUrl =
    kind === "series"
      ? `https://vixsrc.to/api/tv/${vixsrcId}/${season}/${episode}`
      : `https://vixsrc.to/api/movie/${vixsrcId}`;
  const apiRes = await fetch(apiUrl, { headers, cache: "no-store" });
  const apiBody = await apiRes.text();

  let src: string | null = null;
  try {
    src = (JSON.parse(apiBody) as { src?: string }).src ?? null;
  } catch {
    /* not json */
  }
  if (!src) {
    return NextResponse.json({ apiStatus: apiRes.status, apiBody: apiBody.slice(0, 800) });
  }

  const embedRes = await fetch(`https://vixsrc.to${src}`, {
    headers: { ...headers, accept: "text/html,application/xhtml+xml" },
    cache: "no-store",
  });
  const html = await embedRes.text();

  const windows: string[] = [];
  for (const needle of ["window.movie", "window.serie", "expires", "m3u8", "master", "playlist"]) {
    let index = html.indexOf(needle);
    let seen = 0;
    while (index !== -1 && seen < 2) {
      windows.push(`«${needle}» ${html.slice(Math.max(0, index - 120), index + 420)}`);
      seen += 1;
      index = html.indexOf(needle, index + needle.length);
    }
  }

  return NextResponse.json({
    apiStatus: apiRes.status,
    src,
    embedStatus: embedRes.status,
    htmlLength: html.length,
    windows,
  });
}
