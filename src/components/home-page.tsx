"use client";

import { Billboard } from "@/components/billboard";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { LiveRows } from "@/components/live-rows";
import { PersonalRows } from "@/components/personal-rows";
import { Row, ContinueRow } from "@/components/row";
import { useStore, type WatchProgress } from "@/components/store";
import { dynamicRows, rows } from "@/data/rows";
import { getTitle, isKidsSafe } from "@/lib/catalog";
import { useMemo } from "react";

export function HomePage() {
  const { myList, profile, progress } = useStore();

  /* Continue Watching is built from real playback telemetry only — nothing is
     invented, so a row can never claim you watched something you didn't. */
  const continueSlugs = useMemo(() => {
    return (Object.entries(progress) as Array<[string, WatchProgress]>)
      .filter(([slug, p]) => {
        if (!p || typeof p.percent !== "number") return false;
        if (p.percent <= 0.015 || p.percent >= 0.97) return false;
        return Boolean(getTitle(slug));
      })
      .sort((a, b) => (b[1].updated ?? 0) - (a[1].updated ?? 0))
      .map(([slug]) => slug)
      .slice(0, 14);
  }, [progress]);

  const kids = Boolean(profile?.kids);
  const keepKidsSafe = useMemo(
    () => (slugs: string[]) =>
      kids
        ? slugs.filter((slug) => {
            const title = getTitle(slug);
            return Boolean(title && isKidsSafe(title));
          })
        : slugs,
    [kids],
  );

  const shelves = useMemo(() => {
    const all = [...rows, ...dynamicRows];
    if (!kids) return all;
    return all
      .map((row) => ({ ...row, slugs: keepKidsSafe(row.slugs) }))
      .filter((row) => row.slugs.length >= 3);
  }, [kids, keepKidsSafe]);

  return (
    <>
      <Navbar />
      <main>
        <Billboard />

        <div className="relative z-10 -mt-[9vh] pb-10">
          <ContinueRow slugs={keepKidsSafe(continueSlugs)} />

          {myList.length > 0 && (
            <ContinueRow
              slugs={myList.slice(0, 12)}
              title="My List"
              hint={`${myList.length} saved title${myList.length === 1 ? "" : "s"}`}
              showProgress={false}
            />
          )}

          <PersonalRows />

          <LiveRows />

          {shelves.map((row, i) => (
            <Row key={row.id} row={row} priority={i < 2} />
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
