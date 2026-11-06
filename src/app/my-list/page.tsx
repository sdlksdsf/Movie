"use client";

import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PosterTile } from "@/components/row";
import { useStore } from "@/components/store";
import { getTitle } from "@/lib/catalog";

export default function MyListPage() {
  const { myList, hydrated } = useStore();
  const titles = myList.map(getTitle).filter(Boolean);

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 pb-20 pt-28 md:px-12 md:pt-32">
        <div className="mx-auto max-w-[1400px]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-netflix-red">
            Saved
          </p>
          <h1 className="font-display text-[clamp(2rem,4.4vw,3.4rem)] leading-none tracking-wide text-white">
            My List
          </h1>
          <p className="mt-3 text-sm text-white/55">
            {hydrated
              ? `${titles.length} title${titles.length === 1 ? "" : "s"} saved on this device`
              : "Loading your list…"}
          </p>

          {hydrated && titles.length === 0 ? (
            <div className="mt-14 grid place-items-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-20 text-center">
              <span className="mb-4 text-4xl">🍿</span>
              <h2 className="text-lg font-semibold text-white">Nothing saved yet</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/55">
                Tap the <span className="text-white">+</span> on any title to park it here. Your list
                lives in this browser, no account needed.
              </p>
              <Link
                href="/browse"
                className="mt-6 rounded bg-netflix-red px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-netflix-red-dark"
              >
                Browse the catalogue
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {titles.map((t) => t && <PosterTile key={t.slug} title={t} />)}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
