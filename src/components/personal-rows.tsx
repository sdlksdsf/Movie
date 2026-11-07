"use client";

import { useMemo } from "react";
import { Row } from "@/components/row";
import { useStore } from "@/components/store";
import { isKidsSafe } from "@/lib/catalog";
import { becauseYouWatched, favouriteGenre, topPicks } from "@/lib/taste";
import type { Title } from "@/lib/types";

/**
 * Shelves that adapt to what the profile actually watches: a personalised
 * ranking, a "because you watched" shelf built from the last title, and one
 * built around the dominant genre.
 */
export function PersonalRows() {
  const { progress, profile } = useStore();
  const kids = Boolean(profile?.kids);

  const rows = useMemo(() => {
    const safe = (titles: Title[]) => (kids ? titles.filter(isKidsSafe) : titles);
    const out: Array<{ id: string; title: string; hint?: string; slugs: string[]; ranked?: boolean }> = [];

    const picks = safe(topPicks(progress, 18));
    if (picks.length >= 5) {
      out.push({
        id: "top-picks",
        title: "Top Picks for You",
        hint: "Ranked by what you actually watch",
        slugs: picks.map((t) => t.slug),
      });
    }

    const because = becauseYouWatched(progress, 14);
    if (because) {
      const titles = safe(because.titles);
      if (titles.length >= 4) {
        out.push({
          id: `because-${because.source.slug}`,
          title: `Because You Watched ${because.source.name}`,
          hint: "Same mood, same genre",
          slugs: titles.map((t) => t.slug),
        });
      }
    }

    const genre = favouriteGenre(progress);
    if (genre) {
      const genreTitles = safe(
        [...topPicks(progress, 40)].filter((t) => t.genres.includes(genre)),
      );
      if (genreTitles.length >= 5) {
        out.push({
          id: `genre-${genre.toLowerCase()}`,
          title: `More ${genre} Like You Watch`,
          hint: `Your most-watched genre`,
          slugs: genreTitles.slice(0, 16).map((t) => t.slug),
        });
      }
    }

    return out;
  }, [progress, kids]);

  if (rows.length === 0) return null;

  return (
    <>
      {rows.map((row) => (
        <Row key={row.id} row={row} />
      ))}
    </>
  );
}
