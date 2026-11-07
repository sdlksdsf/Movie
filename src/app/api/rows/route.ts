import { NextResponse } from "next/server";
import { getTitle } from "@/lib/catalog";
import { rows } from "@/data/rows";
import { serializeTitle } from "@/lib/api-serialize";

export const dynamic = "force-static";

/** GET /api/rows — the home-page row composition, resolved to titles. */
export async function GET() {
  const resolved = rows
    .map((row) => ({
      id: row.id,
      title: row.title,
      ranked: Boolean(row.ranked),
      continueWatching: Boolean(row.continueWatching),
      hint: row.hint ?? null,
      titles: row.slugs.map((slug) => getTitle(slug)).filter(Boolean).map((t) => serializeTitle(t!)),
    }))
    .filter((row) => row.titles.length > 0);

  return NextResponse.json({ count: resolved.length, rows: resolved });
}
