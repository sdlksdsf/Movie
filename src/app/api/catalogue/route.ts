import { NextResponse } from "next/server";
import {
  CATALOGUE_TARGET,
  buildCatalogue,
  hasCatalogueKey,
  isKidsEntry,
  type CatalogueTab,
} from "@/lib/catalogue";

export const revalidate = 21_600;

const TABS: CatalogueTab[] = ["movie", "series", "anime"];

/**
 * GET /api/catalogue?tab=movie|series|anime&offset=0&limit=120&genre=28&kids=1
 *
 * The 1,000-title catalogue for one tab, popularity ordered. `total` is the
 * size of the whole shelf, `results` is the requested window — the UI walks it
 * 120 at a time so scrolling stays cheap on a phone.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = (searchParams.get("tab") ?? "movie") as CatalogueTab;
  if (!TABS.includes(tab)) {
    return NextResponse.json({ error: "unknown tab" }, { status: 400 });
  }

  const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 120) || 120, 1), 240);
  const genre = Number(searchParams.get("genre")) || 0;
  const kids = searchParams.get("kids") === "1";

  if (!hasCatalogueKey()) {
    return NextResponse.json(
      {
        tab,
        total: 0,
        target: CATALOGUE_TARGET,
        offset,
        count: 0,
        results: [],
        note: "No catalogue credential configured; the bundled titles are still browsable.",
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  let all = await buildCatalogue(tab);
  if (genre) all = all.filter((entry) => entry.genres.includes(genre));
  if (kids) all = all.filter(isKidsEntry);

  const results = all.slice(offset, offset + limit);

  return NextResponse.json(
    { tab, total: all.length, target: CATALOGUE_TARGET, offset, count: results.length, results },
    {
      headers: {
        "cache-control": "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    },
  );
}
