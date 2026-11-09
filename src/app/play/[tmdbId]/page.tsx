import { Player } from "@/components/player";
import { seasonsFor } from "@/lib/catalog";
import { animeInfo, animeSeasons, movieInfo, realSeasons, seriesInfo } from "@/lib/seasons";
import type { Genre, Title } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Play anything the live catalogue finds.
 *  /play/155?title=The Dark Knight&kind=movie
 *  /play/16498?title=Attack on Titan&kind=series&anime=1   (AniList id)
 *
 * The page now asks TMDB for the real show (or film) instead of inventing a
 * placeholder: proper synopsis, rating, genres, runtime, artwork — and for a
 * series, **every season with its real episodes**.
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
    /** season / episode to open on (deep links, "next episode") */
    s?: string;
    e?: string;
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

  const [show, film, anime] = await Promise.all([
    kind === "series" && tmdbResolved ? seriesInfo(tmdbResolved) : Promise.resolve(null),
    kind === "movie" && tmdbResolved ? movieInfo(tmdbResolved) : Promise.resolve(null),
    isAnime ? animeInfo({ anilistId: anilistResolved, malId: explicitMal }) : Promise.resolve(null),
  ]);

  const genres = (show?.genres ?? film?.genres ?? anime?.genres ?? []).filter(Boolean) as Genre[];
  const name =
    show?.name ?? film?.name ?? anime?.name ?? query.title?.slice(0, 120) ?? `Title ${id}`;
  const year =
    show?.year ?? film?.year ?? anime?.year ?? (Number(query.year) || new Date().getFullYear());

  const title: Title = {
    slug: `external-${id}`,
    tmdbId: tmdbResolved,
    anilistId: anime?.anilistId ?? anilistResolved,
    malId: anime?.malId ?? explicitMal,
    anime: isAnime,
    kind,
    name,
    year,
    genres,
    maturity: film?.maturity ?? show?.maturity ?? (kind === "series" ? "TV-14" : "16+"),
    seasons: show?.seasons ?? anime?.episodes ?? (kind === "series" ? 1 : undefined),
    runtime:
      film?.runtime ??
      show?.runtime ??
      anime?.runtime ??
      (kind === "movie" ? 118 : undefined),
    rating: show?.rating ?? film?.rating ?? anime?.rating ?? 8,
    match: Math.round((show?.rating ?? film?.rating ?? anime?.rating ?? 8) * 10),
    tagline: show?.tagline ?? film?.tagline ?? "Streaming now.",
    overview:
      show?.overview ??
      film?.overview ??
      anime?.overview ??
      `${name} — playing from the live catalogue.`,
    creator: "NOFLIX live",
    cast: [],
    accent: "#141414",
    format: kind === "series" ? (show?.seasons === 1 ? "Limited Series" : "Series") : "Film",
  };

  /* real episodes when TMDB/AniList knows the show, generated ones only as a
     last resort — this is what used to collapse every series to one season */
  const seasons = isAnime
    ? await animeSeasons({ anilistId: title.anilistId, malId: title.malId })
    : kind === "series" && tmdbResolved
      ? await realSeasons(tmdbResolved)
      : [];
  const usable = seasons.length ? seasons : kind === "series" ? seasonsFor(title) : [];

  const wantedSeason = Math.max(Number(query.s) || 1, 1);
  const initialSeason = usable.some((entry) => entry.number === wantedSeason)
    ? wantedSeason
    : usable[0]?.number ?? 1;
  const episodeCount =
    usable.find((entry) => entry.number === initialSeason)?.episodes.length ?? 1;
  const initialEpisode = Math.min(Math.max(Number(query.e) || 1, 1), episodeCount);

  return (
    <Player
      title={title}
      initialSeason={initialSeason}
      initialEpisode={initialEpisode}
      seasons={usable}
      artwork={{
        poster: film?.poster ?? show?.poster ?? anime?.poster ?? query.poster,
        backdrop: film?.backdrop ?? show?.backdrop ?? anime?.backdrop ?? query.backdrop,
      }}
    />
  );
}
