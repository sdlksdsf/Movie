"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PlayIcon } from "@/components/icons";
import {
  MOVIE_GENRES,
  SERIES_GENRES,
  discoverPage,
  type CatalogItem,
  type Tab,
} from "@/lib/discover";
import { cn } from "@/lib/cn";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "movie", label: "Films" },
  { id: "series", label: "Series" },
  { id: "anime", label: "Anime" },
];

/**
 * The living catalogue: every film, series and anime TMDB knows about, paged in
 * as you scroll. Cards are plain <img> with lazy loading so a 1000-tile grid
 * stays smooth on a phone.
 */
export function LiveCatalogue() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("movie");
  const [genreId, setGenreId] = useState<number | undefined>(undefined);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const run = useRef(0);

  const load = useCallback(
    async (target: Tab, genre: number | undefined, nextPage: number) => {
      if (busy.current) return;
      busy.current = true;
      const ticket = ++run.current;
      setLoading(true);

      const results = await discoverPage({ tab: target, genreId: genre, page: nextPage, reset: nextPage === 1 });
      if (ticket !== run.current) {
        busy.current = false;
        return;
      }

      setItems((current) => (nextPage === 1 ? results : [...current, ...results]));
      setPage(nextPage);
      setDone(results.length === 0);
      setLoading(false);
      busy.current = false;
    },
    [],
  );

  /* start over whenever the filter changes */
  useEffect(() => {
    setItems([]);
    setPage(1);
    setDone(false);
    void load(tab, genreId, 1);
  }, [tab, genreId, load]);

  /* infinite scroll */
  useEffect(() => {
    const node = sentinel.current;
    if (!node || done) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !busy.current && !done) {
          void load(tab, genreId, page + 1);
        }
      },
      { rootMargin: "900px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [tab, genreId, page, done, load]);

  const genres = tab === "movie" ? MOVIE_GENRES : tab === "series" ? SERIES_GENRES : [];

  return (
    <>
      <Navbar />
      <main className="min-h-screen pb-16 pt-24 md:pt-28">
        <div className="mx-auto max-w-[1500px] px-4 md:px-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#e50914]">
                Browse
              </p>
              <h1 className="mt-1 font-display text-[clamp(1.6rem,4vw,2.6rem)] leading-none text-white">
                The full catalogue
              </h1>
              <p className="mt-2 text-[12.5px] text-white/50">
                Thousands of films, series and anime — {items.length.toLocaleString()} loaded so far, more as you scroll.
              </p>
            </div>
          </div>

          {/* tabs */}
          <div className="mt-5 flex gap-2">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setGenreId(undefined);
                  setTab(entry.id);
                }}
                className={cn(
                  "rounded-full px-4 py-1.5 text-[13px] font-semibold transition",
                  tab === entry.id
                    ? "bg-white text-black"
                    : "bg-white/10 text-white/75 hover:bg-white/20 hover:text-white",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {/* genre chips */}
          {genres.length > 0 && (
            <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
              <Chip active={!genreId} onClick={() => setGenreId(undefined)}>
                All
              </Chip>
              {genres.map((genre) => (
                <Chip
                  key={genre.id}
                  active={genreId === genre.id}
                  onClick={() => setGenreId(genre.id === genreId ? undefined : genre.id)}
                >
                  {genre.name}
                </Chip>
              ))}
            </div>
          )}

          {/* grid */}
          <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 md:gap-3 lg:grid-cols-6 xl:grid-cols-7">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  router.push(
                    `/play/${item.tmdbId}?title=${encodeURIComponent(item.name)}&kind=${
                      item.kind === "series" ? "series" : "movie"
                    }${item.anime ? "&anime=1" : ""}&year=${item.year ?? ""}`,
                  )
                }
                className="group relative overflow-hidden rounded-[6px] bg-[#1b1b1b] text-left ring-1 ring-white/5 transition duration-200 hover:z-10 hover:ring-white/40 focus-brand"
              >
                <span className="relative block aspect-[2/3] w-full overflow-hidden">
                  {item.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.poster}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#232323] to-[#0f0f0f] p-2 text-center text-[11px] text-white/60">
                      {item.name}
                    </span>
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                  <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
                    <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-black/40 text-white">
                      <PlayIcon width={12} height={12} />
                    </span>
                  </span>
                  {item.anime && (
                    <span className="absolute left-1 top-1 rounded-sm bg-[#e50914] px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                      Anime
                    </span>
                  )}
                </span>
                <span className="block px-1.5 pb-1.5 pt-1.5">
                  <span className="block truncate text-[11px] font-medium leading-tight text-white/90">
                    {item.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[9.5px] text-white/45">
                    {item.rating ? <span className="font-semibold text-[#46d369]">{item.rating}</span> : null}
                    {item.year ? <span>· {item.year}</span> : null}
                  </span>
                </span>
              </button>
            ))}

            {loading &&
              Array.from({ length: 14 }).map((_, index) => (
                <div key={`skeleton-${index}`} className="animate-pulse">
                  <div className="aspect-[2/3] w-full rounded-[6px] bg-white/[0.06]" />
                  <div className="mt-1.5 h-2.5 w-3/4 rounded bg-white/[0.06]" />
                </div>
              ))}
          </div>

          <div ref={sentinel} className="h-10" />

          {done && items.length > 0 && (
            <p className="pb-6 text-center text-[12px] text-white/35">
              That&apos;s the end of this shelf — try another filter.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[12px] transition",
        active
          ? "border-white bg-white text-black"
          : "border-white/20 text-white/70 hover:border-white/50 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
