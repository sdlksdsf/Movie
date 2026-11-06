import { NextResponse } from "next/server";
import { searchTitles } from "@/lib/catalog";
import { serializeTitle } from "@/lib/api-serialize";
import { externalSearch, providers } from "@/lib/providers";

/**
 * GET /api/search?q=&live=1
 * Local catalogue hits come back instantly. `live=1` additionally fans out to
 * the keyless metadata providers (TVMaze, IMDb, Jikan) and TMDB when a key is
 * configured, so the search box can surface titles that are not bundled yet.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const live = searchParams.get("live") === "1";

  if (!q) return NextResponse.json({ query: "", local: [], external: [], providers: [] });

  const local = searchTitles(q, 24).map(serializeTitle);
  const external = live ? await externalSearch(q) : [];

  return NextResponse.json({
    query: q,
    local,
    external,
    providers: Object.values(providers)
      .filter((p) => p.enabled)
      .map((p) => ({ id: p.id, label: p.label })),
  });
}
