"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PlayIcon } from "@/components/icons";
import { useStore } from "@/components/store";
import { cn } from "@/lib/cn";

type Tab = "movie" | "series" | "anime";

type Entry = {
  key: string;
  tmdbId: number;
  kind: "movie" | "series";
  name: string;
  year?: number;
  rating?: number;
  poster?: string;
  genres: number[];
  anime?: boolean;
  /** which shelf found it: kids/family, mature (R / TV-MA), or general */
  audience?: "kids" | "family" | "mature" | "general";
};

/** The audience filters offered on top of the tab + genre chips. */
const AUDIENCES: Array<{ id: AudienceId; label: string; hint: string }> = [
  { id: "all", label: "Everything", hint: "the whole shelf" },
  { id: "kids", label: "Kids & family", hint: "G, PG, family animation" },
  { id: "mature", label: "Mature", hint: "R-rated, TV-MA, crime, horror" },
];

type AudienceId = "all" | "kids" | "mature";

const TABS: Array<{ id: Tab; label: string; noun: string }> = [
  { id: "movie", label: "Films", noun: "films" },
  { id: "series", label: "Series", noun: "series" },
  { id: "anime", label: "Anime", noun: "anime" },
];

const GENRES: Record<Tab, Array<{ id: number; name: string }>> = {
  movie: [
    { id: 28, name: "Action" },
    { id: 12, name: "Adventure" },
    { id: 16, name: "Animation" },
    { id: 35, name: "Comedy" },
    { id: 80, name: "Crime" },
    { id: 99, name: "Documentary" },
    { id: 18, name: "Drama" },
    { id: 10751, name: "Family" },
    { id: 14, name: "Fantasy" },
    { id: 27, name: "Horror" },
    { id: 9648, name: "Mystery" },
    { id: 10749, name: "Romance" },
    { id: 878, name: "Sci-Fi" },
    { id: 53, name: "Thriller" },
    { id: 37, name: "Western" },
  ],
  series: [
    { id: 10759, name: "Action & Adventure" },
    { id: 16, name: "Animation" },
    { id: 35, name: "Comedy" },
    { id: 80, name: "Crime" },
    { id: 99, name: "Documentary" },
    { id: 18, name: "Drama" },
    { id: 10751, name: "Family" },
    { id: 9648, name: "Mystery" },
    { id: 10765, name: "Sci-Fi & Fantasy" },
    { id: 10764, name: "Reality" },
  ],
  anime: [
    { id: 10759, name: "Action" },
    { id: 35, name: "Comedy" },
    { id: 18, name: "Drama" },
    { id: 14, name: "Fantasy" },
    { id: 10765, name: "Sci-Fi" },
    { id: 10749, name: "Romance" },
  ],
};

const PAGE = 96;

/**
 * The 1,000-title catalogue.
 *
 * One API route builds exactly 1,000 films, series and anime (popularity
 * ordered, artwork complete). The grid walks that shelf 120 tiles at a time on
 * an IntersectionObserver, so it feels instant and stays smooth on a phone no
 * matter how far you scroll.
 */
export function LiveCatalogue({
  initialTab,
  heading = "The full catalogue",
  chrome = true,
}: {
  /** the tab this page opens on — the switcher stays available either way */
  initialTab?: Tab;
  heading?: string;
  chrome?: boolean;
} = {}) {
  const router = useRouter();
  const { profile } = useStore();
  const kids = Boolean(profile?.kids);

  const [tab, setTab] = useState<Tab>(initialTab ?? "movie");
  const [audience, setAudience] = useState<AudienceId>("all");
  const [genreId, setGenreId] = useState<number | undefined>(undefined);
  const [items, setItems] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const run = useRef(0);

  const load = useCallback(
    async (
      target: Tab,
      genre: number | undefined,
      offset: number,
      audienceId: AudienceId,
    ) => {
      if (busy.current) return;
      busy.current = true;
      const ticket = ++run.current;
      setLoading(true);

      try {
        const params = new URLSearchParams({
          tab: target,
          offset: String(offset),
          limit: String(PAGE),
        });
        if (genre) params.set("genre", String(genre));
        if (kids) params.set("kids", "1");
        if (audienceId !== "all") params.set("audience", audienceId);

        const res = await fetch(`/api/catalogue?${params.toString()}`);
        const data = (await res.json()) as {
          results?: Entry[];
          total?: number;
          count?: number;
        };
        if (ticket !== run.current) return;

        const fresh = data.results ?? [];
        setTotal(data.total ?? 0);
        setItems((current) => (offset === 0 ? fresh : [...current, ...fresh]));
        setDone(fresh.length === 0 || offset + fresh.length >= (data.total ?? 0));
      } catch {
        if (ticket === run.current) setDone(true);
      } finally {
        if (ticket === run.current) {
          setLoading(false);
          busy.current = false;
        }
      }
    },
    [kids],
  );

  /* start over whenever the filter changes */
  useEffect(() => {
    setItems([]);
    setTotal(0);
    setDone(false);
    busy.current = false;
    void load(tab, genreId, 0, audience);
  }, [tab, genreId, audience, load]);

  /* walk the shelf as you scroll */
  useEffect(() => {
    const node = sentinel.current;
    if (!node || done) return;
    const observer = new IntersectionObserver(
      (entries) => {
        /* only walk further once the reader has actually started scrolling —
           otherwise the first paint can chain-load the whole shelf */
        if (entries[0]?.isIntersecting && !busy.current && window.scrollY > 240) {
          void load(tab, genreId, items.length, audience);
        }
      },
      { rootMargin: "420px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [items.length, done, tab, genreId, audience, load]);

  const genres = useMemo(() => GENRES[tab], [tab]);
  const activeTab = TABS.find((entry) => entry.id === tab) ?? TABS[0];
  const progress = total > 0 ? Math.round((items.length / total) * 100) : 0;

  return (
    <>
      {chrome && <Navbar />}
      <main className={cn("min-h-screen pb-16", chrome && "pt-24 md:pt-28")}>
        <div className="mx-auto max-w-[1500px] px-4 md:px-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--nf-accent)]">
                {kids ? "Kid-safe shelf" : "Browse"}
              </p>
              <h1 className="mt-1 font-display text-[clamp(1.6rem,4vw,2.6rem)] leading-none text-white">
                {heading}
              </h1>
              <p className="mt-2 max-w-[60ch] text-[12.5px] text-white/50">
                {total > 0
                  ? `${total.toLocaleString()} ${activeTab.noun} ready to stream — ${items.length.toLocaleString()} loaded${genreId ? " after filtering" : ""}. More tiles appear as you scroll.`
                  : kids
                    ? "Loading the kid-safe shelf — family, animation and comedy only."
                    : "Loading the shelf — films, series and anime, popularity ordered."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
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
          </div>

          {/* audience chips — everything, kids/family, mature */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {AUDIENCES.map((option) => (
              <Chip
                key={option.id}
                active={audience === option.id}
                onClick={() => setAudience(option.id)}
              >
                {option.label}
              </Chip>
            ))}
            {kids && (
              <span className="text-[11px] text-white/40">
                Kid-safe profile — mature titles are hidden
              </span>
            )}
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

          {/* progress rail — honest, tiny, never blocks the grid */}
          {total > 0 && (
            <div className="mt-4 h-[2px] w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-[var(--nf-accent)] transition-[width] duration-500"
                style={{ width: `${Math.max(progress, 2)}%` }}
              />
            </div>
          )}

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
                style={{ contentVisibility: "auto", containIntrinsicSize: "260px 390px" }}
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
                    <span className="absolute left-1 top-1 rounded-sm bg-[var(--nf-accent)] px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                      Anime
                    </span>
                  )}
                </span>
                <span className="block px-1.5 pb-1.5 pt-1.5">
                  <span className="block truncate text-[11px] font-medium leading-tight text-white/90">
                    {item.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[9.5px] text-white/45">
                    {item.rating ? (
                      <span className="font-semibold text-[#46d369]">{item.rating}</span>
                    ) : null}
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
              That&apos;s the whole shelf — {items.length.toLocaleString()} {activeTab.noun}.
            </p>
          )}
          {done && items.length === 0 && !loading && (
            <div className="pb-8 text-center">
              <p className="text-[13px] text-white/55">
                The live shelf couldn&apos;t be reached just now — the curated catalogue is still
                here.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <a
                  href="/new-popular"
                  className="rounded-full bg-white px-4 py-1.5 text-[12.5px] font-semibold text-black transition hover:bg-white/85"
                >
                  Browse the curated catalogue
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setDone(false);
                    setLoading(true);
                    void load(tab, genreId, 0, audience);
                  }}
                  className="rounded-full bg-white/10 px-4 py-1.5 text-[12.5px] font-semibold text-white/85 transition hover:bg-white/20"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      {chrome && <Footer />}
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
