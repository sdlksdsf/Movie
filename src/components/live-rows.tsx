"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/components/store";
import {
  getKey,
  hasKey,
  jikanShelf,
  resolveAnilistId,
  resolveTmdbId,
  tvmazeShelf,
  setKey,
  tmdbShelves,
  type LiveItem,
  type Shelf,
} from "@/lib/live";

/**
 * Shelves fed by the live APIs (TMDB when a key is present, Jikan otherwise).
 * Clicking plays immediately through /play/{tmdbId} or the anime route.
 */
export function LiveRows({ variant = "home" }: { variant?: "home" | "anime" }) {
  const router = useRouter();
  const { toast, profile } = useStore();
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyDraft, setKeyDraft] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const kids = Boolean(profile?.kids);

  const load = useCallback(async () => {
    setLoading(true);
    const [tmdb, jikan, tvmaze] = await Promise.all([
      hasKey() ? tmdbShelves() : Promise.resolve([] as Shelf[]),
      jikanShelf(),
      variant === "home" ? tvmazeShelf() : Promise.resolve(null),
    ]);

    let next = [...tmdb];
    if (tvmaze) next = [...next, tvmaze];
    if (jikan) {
      next = variant === "anime" ? [{ ...jikan, title: "Top Anime Right Now" }, ...next] : [...next, jikan];
    }
    if (variant === "anime") {
      next = next
        .map((shelf) => ({ ...shelf, items: shelf.items.filter((item) => item.anime) }))
        .filter((shelf) => shelf.items.length >= 3);
    }
    setShelves(next);
    setLoading(false);
  }, [variant]);

  useEffect(() => {
    void load();
  }, [load]);

  const playSeries = async (item: LiveItem) => {
    if (!item.imdbId) return;
    setResolving(item.id);
    const tmdbId = await resolveTmdbId(item.imdbId);
    setResolving(null);
    if (!tmdbId) {
      toast("No streamable source found for that show");
      return;
    }
    router.push(
      `/play/${tmdbId}?title=${encodeURIComponent(item.name)}&kind=series&year=${item.year ?? ""}&poster=${encodeURIComponent(item.poster ?? "")}`,
    );
  };

  const playAnime = async (item: LiveItem) => {
    if (!item.malId) return;
    setResolving(item.id);
    const anilistId = await resolveAnilistId(item.malId);
    setResolving(null);
    if (!anilistId) {
      toast("Could not resolve that anime's source id");
      return;
    }
    router.push(
      `/play/${anilistId}?title=${encodeURIComponent(item.name)}&kind=series&anime=1&year=${item.year ?? ""}&poster=${encodeURIComponent(item.poster ?? "")}`,
    );
  };

  const visible = (items: LiveItem[]) => (kids ? items.filter((item) => (item.rating ?? 0) >= 6.5) : items);

  if (loading) {
    return (
      <section className="mb-10 px-4 md:px-12">
        <div className="mb-3 h-5 w-44 animate-pulse rounded bg-white/10" />
        <div className="flex gap-2.5 overflow-hidden">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="aspect-[2/3] w-[130px] shrink-0 animate-pulse rounded bg-white/[0.06] md:w-[160px]" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      {shelves.map((shelf) => {
        const items = visible(shelf.items);
        if (items.length === 0) return null;
        return (
          <section key={shelf.id} className="relative mb-8">
            <div className="mb-2.5 flex items-baseline gap-3 px-4 md:px-12">
              <h2 className="text-[15px] font-semibold text-white/90 md:text-lg">{shelf.title}</h2>
              {shelf.hint && (
                <span className="hidden text-[11px] uppercase tracking-[0.18em] text-white/35 sm:block">
                  {shelf.hint}
                </span>
              )}
            </div>

            <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-4 pb-2 md:gap-2.5 md:px-12">
              {items.map((item) => {
                const clickable = Boolean(item.tmdbId || item.anilistId || item.malId || item.imdbId);
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    disabled={!clickable}
                    whileHover={{ scale: 1.05, zIndex: 5 }}
                    transition={{ type: "spring", stiffness: 320, damping: 26 }}
                    onClick={() => {
                      if (item.tmdbId) {
                        router.push(
                          `/play/${item.tmdbId}?title=${encodeURIComponent(item.name)}&kind=${item.kind}&year=${item.year ?? ""}&poster=${encodeURIComponent(item.poster ?? "")}`,
                        );
                      } else if (item.malId) {
                        void playAnime(item);
                      } else if (item.imdbId) {
                        void playSeries(item);
                      }
                    }}
                    className="group relative w-[128px] shrink-0 snap-start overflow-hidden rounded-[5px] bg-[#1b1b1b] text-left ring-1 ring-white/5 transition hover:ring-white/40 md:w-[152px]"
                  >
                    <span className="block aspect-[2/3] w-full overflow-hidden">
                      {item.poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.poster}
                          alt={item.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="grid h-full place-items-center bg-gradient-to-br from-[#2a2a2a] to-[#111] px-2 text-center text-[11px] text-white/70">
                          {item.name}
                        </span>
                      )}
                    </span>

                    <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent p-2 pt-7">
                      <span className="block truncate text-[11.5px] font-semibold text-white">{item.name}</span>
                      <span className="block truncate text-[10px] text-white/50">
                        {resolving === item.id ? "Finding source…" : `${item.year ?? ""}${item.rating ? ` · ${item.rating.toFixed(1)}★` : ""}`}
                      </span>
                    </span>

                    <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.12em] text-white/80 backdrop-blur">
                      {item.anime ? "Anime" : item.kind === "series" ? "Series" : "Film"}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </section>
        );
      })}

      {!hasKey() && (
        <section className="mx-4 mb-10 rounded-lg border border-white/10 bg-white/[0.03] p-4 md:mx-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Unlock the full catalogue</p>
              <p className="text-[12px] text-white/50">
                Add a free TMDB API key and this page streams thousands of movies, series and anime live.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowKey((value) => !value)}
              className="rounded bg-white px-4 py-2 text-[12px] font-semibold text-black transition hover:bg-white/85"
            >
              {showKey ? "Hide" : "Add key"}
            </button>
          </div>

          {showKey && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={keyDraft}
                onChange={(event) => setKeyDraft(event.target.value)}
                placeholder="TMDB API key (v3)"
                className="min-w-0 flex-1 rounded border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#e50914]"
              />
              <button
                type="button"
                onClick={() => {
                  const clean = keyDraft.trim();
                  if (!clean) return;
                  setKey(clean);
                  toast("TMDB key saved · loading live catalogue");
                  void load();
                }}
                className="rounded bg-[#e50914] px-4 py-2 text-sm font-semibold text-white"
              >
                Load
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
