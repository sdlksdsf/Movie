import { NextResponse } from "next/server";
import { allTitles, genreFromSlug, searchTitles } from "@/lib/catalog";
import { serializeTitle } from "@/lib/api-serialize";

export const dynamic = "force-dynamic";

/**
 * GET /api/catalog?q=&kind=&genre=&limit=&offset=
 * The public, cacheable catalogue feed. Everything the UI renders comes from
 * here, so a second client (mobile app, widget) can reuse the same data.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const kind = searchParams.get("kind");
  const genreParam = searchParams.get("genre");
  const limit = Math.min(Number(searchParams.get("limit") ?? 500) || 500, 500);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);

  let list = q ? searchTitles(q, 500) : allTitles;

  if (kind === "movie" || kind === "series") list = list.filter((t) => t.kind === kind);

  if (genreParam) {
    const genre = genreFromSlug(genreParam);
    if (genre) list = list.filter((t) => t.genres.includes(genre));
  }

  const total = list.length;
  const page = list.slice(offset, offset + limit).map(serializeTitle);

  return NextResponse.json(
    { total, offset, limit, count: page.length, results: page },
    { headers: { "cache-control": "public, max-age=0, must-revalidate" } },
  );
}
