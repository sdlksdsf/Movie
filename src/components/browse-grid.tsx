"use client";

import { useMemo, useState } from "react";
import { PosterTile } from "@/components/row";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { genres as allGenres, genreSlug } from "@/lib/catalog";
import type { Genre, Title } from "@/lib/types";
import { cn } from "@/lib/cn";

type Sort = "popular" | "rating" | "year" | "az";

export function BrowseGrid({
  titles,
  heading,
  subheading,
  initialGenre,
  lockGenre = false,
}: {
  titles: Title[];
  heading: string;
  subheading?: string;
  initialGenre?: Genre;
  lockGenre?: boolean;
}) {
  const [genre, setGenre] = useState<Genre | "all">(initialGenre ?? "all");
  const [sort, setSort] = useState<Sort>("popular");
  const [query, setQuery] = useState("");

  const available = useMemo(() => {
    const set = new Set<Genre>();
    titles.forEach((t) => t.genres.forEach((g) => set.add(g)));
    return allGenres.filter((g) => set.has(g));
  }, [titles]);

  const results = useMemo(() => {
    let list = titles.filter((t) => genre === "all" || t.genres.includes(genre));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    else if (sort === "year") sorted.sort((a, b) => b.year - a.year);
    else if (sort === "az") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else sorted.sort((a, b) => b.match - a.match);
    return sorted;
  }, [titles, genre, sort, query]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 pb-16 pt-28 md:px-12 md:pt-32">
        <div className="mx-auto max-w-[1400px]">
          <header className="mb-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-netflix-red">
              Browse
            </p>
            <h1 className="font-display text-[clamp(2rem,4.4vw,3.4rem)] leading-none tracking-wide text-white">
              {heading}
            </h1>
            {subheading && <p className="mt-3 max-w-[620px] text-sm text-white/55">{subheading}</p>}
          </header>

          <div className="sticky top-[68px] z-30 -mx-4 mb-6 border-y border-white/5 bg-[#141414]/92 px-4 py-3 backdrop-blur-md md:-mx-12 md:px-12">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto">
                {!lockGenre && (
                  <button
                    type="button"
                    onClick={() => setGenre("all")}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                      genre === "all"
                        ? "border-white bg-white text-black"
                        : "border-white/20 text-white/70 hover:border-white/50 hover:text-white",
                    )}
                  >
                    All
                  </button>
                )}
                {available.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenre(g)}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                      genre === g
                        ? "border-white bg-white text-black"
                        : "border-white/20 text-white/70 hover:border-white/50 hover:text-white",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by title…"
                  className="w-40 rounded border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white outline-none transition placeholder:text-white/35 focus:border-white/50 md:w-48"
                />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  aria-label="Sort titles"
                  className="rounded border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/50"
                >
                  <option value="popular">Popularity</option>
                  <option value="rating">Top rated</option>
                  <option value="year">Newest</option>
                  <option value="az">A – Z</option>
                </select>
              </div>
            </div>
          </div>

          <p className="mb-4 text-xs uppercase tracking-[0.18em] text-white/35">
            {results.length} title{results.length === 1 ? "" : "s"}
            {genre !== "all" && ` · ${genre}`}
          </p>

          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {results.map((t) => (
              <PosterTile key={t.slug} title={t} />
            ))}
          </div>

          {results.length === 0 && (
            <div className="grid place-items-center rounded-lg border border-dashed border-white/15 py-20 text-center">
              <p className="text-sm text-white/60">Nothing here yet.</p>
              <button
                type="button"
                onClick={() => {
                  setGenre("all");
                  setQuery("");
                }}
                className="mt-3 text-xs font-semibold text-[#54b9c5] hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}

          <div className="mt-10 flex flex-wrap gap-2">
            {allGenres.map((g) => (
              <a
                key={g}
                href={`/genre/${genreSlug(g)}`}
                className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/45 transition hover:border-white/40 hover:text-white"
              >
                {g}
              </a>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
