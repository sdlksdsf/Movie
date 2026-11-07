import { Player } from "@/components/player";
import { seasonsFor } from "@/lib/catalog";
import type { Title } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Play anything the live catalogue finds.
 *  /play/155?title=The Dark Knight&kind=movie
 *  /play/16498?title=Attack on Titan&kind=series&anime=1   (AniList id)
 */
export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ tmdbId: string }>;
  searchParams: Promise<{
    title?: string;
    kind?: string;
    year?: string;
    anime?: string;
    poster?: string;
    backdrop?: string;
    /** explicit AniList id (anime servers) */
    anilist?: string;
    /** explicit TMDB id when the path carries an AniList id */
    tmdb?: string;
    /** MyAnimeList id (search results) — resolved to AniList in the player */
    mal?: string;
  }>;
}) {
  const { tmdbId } = await params;
  const query = await searchParams;

  const id = Number(tmdbId);
  const isAnime = query.anime === "1";
  /* Anime can arrive as an AniList id in the path (live anime rows) or as a
     TMDB id plus ?anilist=… (live mixed rows). Normalise both to a pair. */
  const explicitAni = Number(query.anilist) || undefined;
  const explicitMal = Number(query.mal) || undefined;
  const explicitTmdb = Number(query.tmdb) || undefined;
  /* the path is only an AniList id when no TMDB/MAL id was supplied alongside */
  const pathIsAniid = isAnime && !explicitTmdb && !explicitMal;
  const anilistResolved = explicitAni ?? (pathIsAniid ? id : undefined);
  const tmdbResolved = explicitTmdb ?? (pathIsAniid || explicitMal ? 0 : id);
  const kind: "movie" | "series" = isAnime || query.kind === "series" ? "series" : "movie";
  const name = query.title?.slice(0, 120) || `Title ${Number.isFinite(id) ? id : ""}`;
  const year = Number(query.year) || new Date().getFullYear();

  const title: Title = {
    slug: `external-${id}`,
    tmdbId: tmdbResolved,
    anilistId: anilistResolved,
    malId: explicitMal,
    anime: isAnime,
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
    overview: `${name} — playing from the live catalogue.`,
    creator: "NOFLIX live",
    cast: [],
    accent: "#141414",
    format: kind === "series" ? "Series" : "Film",
  };

  return (
    <Player
      title={title}
      initialSeason={1}
      initialEpisode={1}
      seasons={seasonsFor(title)}
      artwork={{ poster: query.poster, backdrop: query.backdrop }}
    />
  );
}
