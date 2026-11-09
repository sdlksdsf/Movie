import { backdropSrc, posterSrc, seasonsFor, similarTo, shortMeta, getTitle } from "@/lib/catalog";
import { seasonsForTmdb } from "@/lib/seasons";
import type { Title } from "@/lib/types";

/** Compact payload used by the JSON API + the live search overlay. */
export function serializeTitle(t: Title) {
  return {
    slug: t.slug,
    tmdbId: t.tmdbId,
    kind: t.kind,
    name: t.name,
    year: t.year,
    maturity: t.maturity,
    runtime: t.runtime,
    match: t.match,
    genres: t.genres,
    overview: t.overview,
    tagline: t.tagline,
    cast: t.cast,
    accent: t.accent,
    featured: Boolean(t.featured),
    meta: shortMeta(t),
    poster: posterSrc(t.slug),
    backdrop: backdropSrc(t.slug),
    watchPath: `/watch/${t.kind}/${t.slug}`,
    titlePath: `/title/${t.slug}`,
    trailerTmdbId: t.tmdbId,
  };
}

export async function serializeTitleDetail(slug: string) {
  const title = getTitle(slug);
  if (!title) return null;
  const seasons =
    title.kind === "series"
      ? await seasonsForTmdb(title.tmdbId, seasonsFor(title))
      : seasonsFor(title);
  return {
    ...serializeTitle(title),
    seasons,
    similar: similarTo(title, 9).map(serializeTitle),
  };
}
