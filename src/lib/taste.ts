import { allTitles, getTitle, similarTo } from "@/lib/catalog";
import type { Genre, Title } from "@/lib/types";

/** Minimal shape of a watch-progress record (mirrors the store). */
export type Watched = {
  season: number;
  episode: number;
  percent: number;
  seconds?: number;
  duration?: number;
  updated: number;
};

export type Progress = Record<string, Watched>;

/**
 * Taste model.
 *
 * Every title the profile has started contributes to genre weights:
 *   started (>=3%)      → 1.0
 *   past halfway        → +1.0
 *   finished (>=90%)    → +1.5
 *   most recent title   → +1.0
 * Genres are then normalised to 0…1 so a heavy binge doesn't dwarf everything.
 */
export function genreWeights(progress: Progress): Array<{ genre: Genre; weight: number }> {
  const raw = new Map<Genre, number>();

  const entries = Object.entries(progress).filter(([, value]) => value.percent > 0.03);
  if (entries.length === 0) return [];

  const newest = [...entries].sort((a, b) => b[1].updated - a[1].updated)[0]?.[0];

  for (const [slug, value] of entries) {
    const title = getTitle(slug);
    if (!title) continue;
    let weight = 1;
    if (value.percent >= 0.5) weight += 1;
    if (value.percent >= 0.9) weight += 1.5;
    if (slug === newest) weight += 1;
    for (const genre of title.genres) raw.set(genre, (raw.get(genre) ?? 0) + weight);
  }

  const max = Math.max(...raw.values(), 1);
  return [...raw.entries()]
    .map(([genre, weight]) => ({ genre, weight: weight / max }))
    .sort((a, b) => b.weight - a.weight);
}

/** 0…1 affinity between a title and the profile's taste. */
export function affinity(title: Title, weights: Array<{ genre: Genre; weight: number }>) {
  if (weights.length === 0) return 0;
  const byGenre = new Map(weights.map((entry) => [entry.genre, entry.weight]));
  const hits = title.genres.map((genre) => byGenre.get(genre) ?? 0);
  if (hits.length === 0) return 0;
  const best = Math.max(...hits);
  const average = hits.reduce((sum, value) => sum + value, 0) / hits.length;
  return best * 0.7 + average * 0.3;
}

/** Personalised ranking: taste first, then rating and freshness. */
export function topPicks(progress: Progress, limit = 16): Title[] {
  const weights = genreWeights(progress);
  const watched = new Set(Object.keys(progress));

  return [...allTitles]
    .filter((title) => !watched.has(title.slug) || (progress[title.slug]?.percent ?? 1) < 0.9)
    .map((title) => ({
      title,
      score:
        affinity(title, weights) * 60 +
        title.rating * 3 +
        (title.year >= 2025 ? 6 : 0) +
        (progress[title.slug] ? -8 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.title);
}

/** "Because you watched X" — the last thing they were into, same-genre neighbours. */
export function becauseYouWatched(
  progress: Progress,
  limit = 14,
): { source: Title; titles: Title[] } | null {
  const entries = Object.entries(progress).filter(([, value]) => value.percent > 0.05);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1].updated - a[1].updated);
  const source = getTitle(entries[0][0]);
  if (!source) return null;

  const watched = new Set(Object.keys(progress));
  const titles = similarTo(source, limit + 6)
    .filter((title) => !watched.has(title.slug) || (progress[title.slug]?.percent ?? 1) < 0.9)
    .slice(0, limit);

  if (titles.length < 4) return null;
  return { source, titles };
}

/** Genre the profile watches most, if it's a clear winner. */
export function favouriteGenre(progress: Progress) {
  const weights = genreWeights(progress);
  if (weights.length === 0) return null;
  const [top, second] = weights;
  if (!top || top.weight < 0.55) return null;
  if (second && top.weight - second.weight < 0.12) return null;
  return top.genre;
}

/** Recommendations for the pause screen: similar titles + taste boost. */
export function moreLikeThis(current: Title, progress: Progress, limit = 6): Title[] {
  const weights = genreWeights(progress);
  const seen = new Map<string, number>();

  for (const title of similarTo(current, 24)) seen.set(title.slug, 10);
  for (const title of topPicks(progress, 24)) {
    seen.set(title.slug, Math.max(seen.get(title.slug) ?? 0, affinity(title, weights) * 9));
  }

  return [...seen.entries()]
    .filter(([slug]) => slug !== current.slug)
    .map(([slug, base]) => {
      const title = getTitle(slug);
      if (!title) return null;
      const sameKind = title.kind === current.kind ? 3 : 0;
      const sameAnime = Boolean(title.anime) === Boolean(current.anime) ? 2 : 0;
      return { title, score: base + sameKind + sameAnime + title.rating / 3 };
    })
    .filter((entry): entry is { title: Title; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.title);
}
