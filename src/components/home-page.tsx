"use client";

import { Billboard } from "@/components/billboard";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { Row, ContinueRow } from "@/components/row";
import { useStore } from "@/components/store";
import { continueWatching, rows } from "@/data/rows";

export function HomePage() {
  const { myList } = useStore();

  return (
    <>
      <Navbar />
      <main>
        <Billboard />

        <div className="relative z-10 -mt-[9vh] pb-10">
          <ContinueRow slugs={continueWatching} />

          {myList.length > 0 && (
            <ContinueRow
              slugs={myList.slice(0, 12)}
              title="My List"
              hint={`${myList.length} saved title${myList.length === 1 ? "" : "s"}`}
              showProgress={false}
            />
          )}

          {rows.map((row, i) => (
            <Row key={row.id} row={row} priority={i < 2} />
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
