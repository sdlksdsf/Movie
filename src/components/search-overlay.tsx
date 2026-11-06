"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { useStore } from "@/components/store";
import { Artwork } from "@/components/artwork";
import { allTitles, genres, genreSlug, searchTitles, shortMeta } from "@/lib/catalog";

const genreColors = [
  "#e50914",
  "#1f6feb",
  "#7a1fa2",
  "#0f9d58",
  "#f4a300",
  "#d81b60",
  "#00838f",
  "#5d4037",
  "#3949ab",
  "#c62828",
  "#2e7d32",
  "#6d4c41",
];

export function SearchOverlay() {
  const { searchOpen, setSearchOpen, openTitle } = useStore();
  const [query, setQuery] = useState("");
  const [live, setLive] = useState<
    Array<{ name: string; year?: number; kind: string; poster?: string; source: string; tmdbId?: number }>
  >([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
    setQuery("");
  }, [searchOpen]);

  const results = useMemo(() => searchTitles(query, 30), [query]);

  // ask the metadata pipeline for anything missing from the bundled catalogue
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setLive([]);
      setLiveLoading(false);
      return;
    }
    setLiveLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}&live=1`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { external: [] }))
        .then((data) => {
          const known = new Set(results.map((t) => t.name.toLowerCase()));
          setLive(
            (data.external ?? []).filter(
              (item: { name: string }) => !known.has(item.name.toLowerCase()),
            ),
          );
        })
        .catch(() => undefined)
        .finally(() => setLiveLoading(false));
    }, 260);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, results]);
  const suggestions = useMemo(
    () => [...allTitles].sort((a, b) => b.rating - a.rating).slice(0, 8),
    [],
  );

  return (
    <AnimatePresence>
      {searchOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] overflow-y-auto bg-[#141414]"
        >
          <div className="sticky top-0 z-10 border-b border-white/10 bg-[#141414]/95 backdrop-blur-xl">
            <div className="mx-auto flex h-[68px] w-full max-w-[1200px] items-center gap-4 px-4 md:px-8">
              <SearchIcon className="shrink-0 text-white/70" width={22} height={22} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Titles, people, genres"
                className="h-full flex-1 bg-transparent text-lg text-white outline-none placeholder:text-white/40 md:text-2xl"
                aria-label="Search"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="focus-brand grid h-10 w-10 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <CloseIcon width={22} height={22} />
              </button>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-8 md:px-8">
            {query.trim().length === 0 ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-white">Top searches</h2>
                <div className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {suggestions.map((t) => (
                    <button
                      key={t.slug}
                      type="button"
                      onClick={() => openTitle(t.slug)}
                      className="group flex items-center gap-3 rounded-md p-2 text-left transition hover:bg-white/5"
                    >
                      <span className="relative h-20 w-[56px] shrink-0 overflow-hidden rounded">
                        <Artwork slug={t.slug} name={t.name} accent={t.accent} sizes="80px" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">{t.name}</span>
                        <span className="block truncate text-xs text-white/45">{shortMeta(t)}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <h2 className="mb-4 text-lg font-semibold text-white">Explore all genres</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {genres.map((genre, i) => (
                    <Link
                      key={genre}
                      href={`/genre/${genreSlug(genre)}`}
                      onClick={() => setSearchOpen(false)}
                      className="group relative grid h-[92px] place-items-center overflow-hidden rounded-md text-base font-semibold text-white transition hover:brightness-110"
                      style={{ backgroundColor: genreColors[i % genreColors.length] }}
                    >
                      <span className="absolute -right-4 -top-2 text-6xl opacity-25">
                        {genre.slice(0, 1)}
                      </span>
                      <span className="relative z-10 px-3 text-center">{genre}</span>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="mb-5 text-sm text-white/50">
                  {results.length > 0
                    ? `Showing ${results.length} result${results.length === 1 ? "" : "s"} for “${query}”`
                    : `No results for “${query}”`}
                </p>
                {results.length === 0 ? (
                  <p className="max-w-md text-sm leading-relaxed text-white/60">
                    Try a different title, an actor (try “DiCaprio”), or a genre such as “Mystery”,
                    “Anime” or “Romance”. You can also press{" "}
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">/</kbd> from anywhere to
                    search.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                    {results.map((t, i) => (
                      <motion.button
                        key={t.slug}
                        type="button"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.3 }}
                        onClick={() => openTitle(t.slug)}
                        className="group relative aspect-[2/3] overflow-hidden rounded-[4px] bg-[#222] ring-1 ring-white/5 transition duration-300 hover:z-10 hover:ring-white/40"
                      >
                        <Artwork
                          slug={t.slug}
                          name={t.name}
                          accent={t.accent}
                          sizes="(max-width: 768px) 30vw, 190px"
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-8 text-left opacity-0 transition group-hover:opacity-100">
                          <span className="block text-xs font-medium text-white">{t.name}</span>
                          <span className="block text-[10px] text-white/60">{shortMeta(t)}</span>
                        </span>
                      </motion.button>
                    ))}
                  </div>
                )}
                {live.length > 0 && (
                  <div className="mt-12">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">More from the live catalogue</h2>
                      {[...new Set(live.map((item) => item.source))].map((source) => (
                        <span
                          key={source}
                          className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-white/50"
                        >
                          {source}
                        </span>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                      {live.map((item, i) => {
                        const href = item.tmdbId
                          ? `/play/${item.tmdbId}?title=${encodeURIComponent(item.name)}&kind=${item.kind}&year=${item.year ?? ""}`
                          : undefined;
                        const inner = (
                          <>
                            <span className="relative block aspect-[2/3] w-full overflow-hidden rounded-[4px] bg-[#222] ring-1 ring-white/5 transition duration-300 group-hover:ring-white/40">
                              {item.poster ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.poster}
                                  alt={item.name}
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="grid h-full place-items-center bg-gradient-to-br from-white/15 to-transparent px-2 text-center text-[11px] text-white/70">
                                  {item.name}
                                </span>
                              )}
                            </span>
                            <span className="mt-1.5 block truncate text-xs text-white/80">{item.name}</span>
                            <span className="block text-[10px] text-white/40">
                              {item.year ?? ""} {href ? "· tap to play" : "· metadata only"}
                            </span>
                          </>
                        );
                        return href ? (
                          <Link
                            key={`${item.source}-${item.name}-${i}`}
                            href={href}
                            onClick={() => setSearchOpen(false)}
                            className="group block"
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div key={`${item.source}-${item.name}-${i}`} className="group block opacity-70">
                            {inner}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {liveLoading && live.length === 0 && (
                  <p className="mt-10 text-xs uppercase tracking-[0.2em] text-white/30">
                    Querying live providers…
                  </p>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
