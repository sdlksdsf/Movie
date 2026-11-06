"use client";

import { Billboard } from "@/components/billboard";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { LiveRows } from "@/components/live-rows";
import { Row, ContinueRow } from "@/components/row";
import { useStore } from "@/components/store";
import { continueWatching, dynamicRows, rows } from "@/data/rows";
import { getTitle, isKidsSafe } from "@/lib/catalog";
import { useMemo } from "react";

export function HomePage() {
  const { myList, profile } = useStore();

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
          <ContinueRow slugs={keepKidsSafe(continueWatching)} />

          {myList.length > 0 && (
            <ContinueRow
              slugs={myList.slice(0, 12)}
              title="My List"
              hint={`${myList.length} saved title${myList.length === 1 ? "" : "s"}`}
              showProgress={false}
            />
          )}

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
