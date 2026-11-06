import { Player } from "@/components/player";
import { seasonsFor } from "@/lib/catalog";
import type { Title } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Play anything the metadata providers can find — even titles that are not in
 * the bundled catalogue yet. `/play/155?title=The%20Dark%20Knight&kind=movie`
 */
function buildTitle(tmdbId: number, name: string, kind: "movie" | "series", year: number): Title {
  return {
    slug: `external-${tmdbId}`,
    tmdbId,
    kind,
    name,
    year,
    genres: [],
    maturity: kind === "series" ? "TV-14" : "16+",
    seasons: kind === "series" ? 1 : undefined,
    runtime: kind === "movie" ? 118 : undefined,
    rating: 8,
    match: 92,
    tagline: "Streaming now.",
    overview: `${name} — playing straight from the live metadata pipeline.`,
    creator: "Live catalogue",
    cast: [],
    accent: "#141414",
    format: kind === "series" ? "Series" : "Film",
  };
}

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ tmdbId: string }>;
  searchParams: Promise<{ title?: string; kind?: string; year?: string }>;
}) {
  const { tmdbId } = await params;
  const query = await searchParams;
  const id = Number(tmdbId);
  const kind = query.kind === "series" ? "series" : "movie";
  const name = query.title?.slice(0, 120) || `Title ${Number.isFinite(id) ? id : ""}`;
  const year = Number(query.year) || new Date().getFullYear();

  const title = buildTitle(Number.isFinite(id) ? id : 0, name, kind, year);

  return <Player title={title} initialSeason={1} initialEpisode={1} seasons={seasonsFor(title)} />;
}
