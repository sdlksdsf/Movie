import { NextResponse } from "next/server";
import { serializeTitleDetail } from "@/lib/api-serialize";
import { allTitles } from "@/lib/catalog";

export function generateStaticParams() {
  return allTitles.map((t) => ({ slug: t.slug }));
}

/** GET /api/catalog/:slug — full record incl. seasons, episodes and similar titles. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = serializeTitleDetail(slug);
  if (!detail) return NextResponse.json({ error: "Title not found", slug }, { status: 404 });
  return NextResponse.json(detail);
}
