import { NextResponse } from "next/server";
import { providers } from "@/lib/providers";

export const dynamic = "force-static";

/** GET /api/providers — which metadata sources are live in this deployment. */
export async function GET() {
  return NextResponse.json({
    local: { id: "local", label: "Bundled catalogue", enabled: true },
    providers: Object.values(providers),
    note: "TMDB unlocks the full multi-million-title catalogue. The others are keyless and always on.",
  });
}
