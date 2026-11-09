"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/components/store";

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
  audience?: "kids" | "mature" | "explicit" | "general";
  explicit?: boolean;
};

type Shelf = {
  id: string;
  title: string;
  hint: string;
  audience: string;
  tab: "movie" | "series";
  explicit?: boolean;
};

/**
 * Audience shelves: kids/family, R-rated, and — only for a profile that has
 * chosen "All" maturity — the 18+ shelf.
 *
 * These read the same `/api/catalogue` the browse page uses, so they cannot
 * drift from it, and the server drops `explicit` titles unless the request
 * literally asked for them.
 */
const SHELVES: Shelf[] = [
  {
    id: "kids",
    title: "Kids & Family",
    hint: "Certified G and PG",
    audience: "kids",
    tab: "movie",
  },
  {
    id: "mature",
    title: "R-Rated & Mature",
    hint: "Certified R — not for the little ones",
    audience: "mature",
    tab: "movie",
  },
];

const AFTER_DARK: Shelf = {
  id: "after-dark",
  title: "18+ After Dark",
  hint: "Adult titles — visible only on an All-maturity profile",
  audience: "explicit",
  tab: "movie",
  explicit: true,
};

const cardUrl = (entry: Entry) =>
  `/play/${entry.tmdbId}?kind=${entry.kind}${entry.anime ? "&anime=1" : ""}&title=${encodeURIComponent(
    entry.name,
  )}${entry.year ? `&year=${entry.year}` : ""}${entry.poster ? `&poster=${encodeURIComponent(entry.poster)}` : ""}`;

export function AudienceShelves() {
  const { profile } = useStore();
  const kids = Boolean(profile?.kids);
  const level = profile?.maturity ?? "";
  /* R-rated needs a 16+ profile, 18+ needs the All profile, kids see neither */
  const matureOk = !kids && (level === "16" || level === "all");
  /*
   * 18+ shelf: needs a saved profile pinned to "All" maturity *and* a switch the
   * viewer flipped themselves. A signed-out visitor has no age on file, so the
   * row stays hidden rather than defaulting to the widest setting.
   */
  const adultOk = Boolean(profile) && !kids && level === "all";
  const [optedIn, setOptedIn] = useState(false);

  useEffect(() => {
    try {
      setOptedIn(window.localStorage.getItem("nf.adult") === "1");
    } catch {
      /* storage disabled — stay off */
    }
  }, []);

  const adult = adultOk && optedIn;

  const wanted = useMemo(() => {
    if (kids) return [];
    const shelves = SHELVES.filter((shelf) => shelf.id !== "mature" || matureOk);
    return adult ? [...shelves, AFTER_DARK] : shelves;
  }, [adult, kids, matureOk]);

  const [data, setData] = useState<Record<string, Entry[]>>({});

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const entries = await Promise.all(
        wanted.map(async (shelf) => {
          const params = new URLSearchParams({
            tab: shelf.tab,
            audience: shelf.audience,
            limit: "20",
          });
          if (shelf.explicit) params.set("explicit", "1");
          try {
            const res = await fetch(`/api/catalogue?${params.toString()}`);
            if (!res.ok) return [shelf.id, [] as Entry[]] as const;
            const payload = (await res.json()) as { results?: Entry[] };
            /* never trust the response alone: a kid-safe profile filters again */
            const results = (payload.results ?? []).filter((entry) =>
              kids ? !entry.explicit && entry.audience === "kids" : true,
            );
            return [shelf.id, results] as const;
          } catch {
            return [shelf.id, [] as Entry[]] as const;
          }
        }),
      );
      if (!alive) return;
      setData(Object.fromEntries(entries));
    };
    void load();
    return () => {
      alive = false;
    };
  }, [wanted, kids]);

  return (
    <>
      {wanted.map((shelf) => {
        const items = data[shelf.id] ?? [];
        if (!items.length) return null;
        return (
          <section key={shelf.id} className="relative mb-8">
            <div className="mb-2.5 flex items-baseline gap-3 px-4 md:px-12">
              <h2 className="text-[15px] font-semibold text-white/90 md:text-lg">{shelf.title}</h2>
              <span className="hidden text-[11px] uppercase tracking-[0.18em] text-white/35 sm:block">
                {shelf.hint}
              </span>
            </div>

            <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-4 pb-2 md:gap-2.5 md:px-12">
              {items.map((entry) => (
                <motion.div
                  key={entry.key}
                  whileHover={{ scale: 1.05, zIndex: 5 }}
                  transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  className="relative w-[128px] shrink-0 snap-start overflow-hidden rounded-[5px] bg-[#1b1b1b] ring-1 ring-white/5 transition hover:ring-white/40 md:w-[152px]"
                >
                  <Link href={cardUrl(entry)} className="group block text-left">
                    <span className="block aspect-[2/3] w-full overflow-hidden">
                      {entry.poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.poster}
                          alt={entry.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="grid h-full place-items-center bg-gradient-to-br from-[#2a2a2a] to-[#111] px-2 text-center text-[11px] text-white/70">
                          {entry.name}
                        </span>
                      )}
                    </span>
                    <span className="relative block px-2 pb-2 pt-1.5">
                      <span className="block truncate text-[11.5px] font-semibold text-white">
                        {entry.name}
                      </span>
                      <span className="block truncate text-[10px] text-white/50">
                        {entry.year ?? ""}
                        {entry.rating ? ` · ${entry.rating.toFixed(1)}★` : ""}
                      </span>
                    </span>
                    <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.12em] text-white/80 backdrop-blur">
                      {entry.explicit ? "18+" : entry.kind === "series" ? "Series" : "Film"}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
