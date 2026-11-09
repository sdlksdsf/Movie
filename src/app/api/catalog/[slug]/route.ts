import { NextResponse } from "next/server";
import { serializeTitleDetail } from "@/lib/api-serialize";
export const revalidate = 3600;

/** GET /api/catalog/:slug — full record incl. seasons, episodes and similar titles. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await serializeTitleDetail(slug);
  if (!detail) return NextResponse.json({ error: "Title not found", slug }, { status: 404 });
  return NextResponse.json(detail);
}
