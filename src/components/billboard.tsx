"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Artwork } from "@/components/artwork";
import { CheckIcon, InfoIcon, PlayIcon, PlusIcon } from "@/components/icons";
import { useStore } from "@/components/store";
import { featuredTitles, shortMeta } from "@/lib/catalog";
import { cn } from "@/lib/cn";

const ROTATE_MS = 11_000;

export function Billboard() {
  const features = featuredTitles().slice(0, 6);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const router = useRouter();
  const { openTitle, inList, toggleList, toast } = useStore();
  const timer = useRef<number | null>(null);

  const active = features[index] ?? features[0];

  const go = useCallback(
    (next: number) => setIndex((next + features.length) % features.length),
    [features.length],
  );

  useEffect(() => {
    if (paused || features.length < 2) return;
    timer.current = window.setTimeout(() => go(index + 1), ROTATE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [index, paused, go, features.length]);

  if (!active) return null;

  const saved = inList(active.slug);

  return (
    <section
      className="relative h-[88svh] min-h-[560px] w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* backdrop layers */}
      <AnimatePresence initial={false}>
        <motion.div
          key={active.slug}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <div className="kenburns absolute inset-0">
            <Artwork
              slug={active.slug}
              name={active.name}
              kind="backdrop"
              accent={active.accent}
              priority
              sizes="100vw"
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/25 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/55 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 to-transparent" />

      {/* content */}
      <div className="absolute inset-x-0 bottom-[13%] z-10 px-4 md:px-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.slug}
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
            className="max-w-[640px]"
          >
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/75">
              <span className="font-display text-lg leading-none text-netflix-red">N</span>
              <span>{active.kind === "series" ? "Series" : "Film"}</span>
            </div>

            <h1 className="font-display text-[clamp(2.4rem,6vw,5.2rem)] leading-[0.92] tracking-[0.01em] text-white drop-shadow-[0_6px_30px_rgba(0,0,0,0.7)]">
              {active.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-white/85">
              <span className="font-semibold text-[#46d369]">{active.match}% Match</span>
              <span>{active.year}</span>
              <span className="rounded border border-white/40 px-1.5 py-[1px] text-[11px] uppercase tracking-wide">
                {active.maturity}
              </span>
              <span>{shortMeta(active)}</span>
              <span className="hidden rounded bg-white/15 px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-[0.16em] sm:inline">
                HD
              </span>
            </div>

            <p className="mt-4 max-w-[520px] text-[13.5px] leading-relaxed text-white/85 [text-shadow:0_2px_10px_rgba(0,0,0,0.8)] md:text-[15px]">
              {active.overview}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => router.push(`/watch/${active.kind}/${active.slug}`)}
                className="focus-brand flex items-center gap-2 rounded-[4px] bg-white px-6 py-3 text-[15px] font-semibold text-black transition duration-200 hover:bg-white/85 active:scale-[0.98]"
              >
                <PlayIcon width={20} height={20} />
                Play
              </button>
              <button
                type="button"
                onClick={() => openTitle(active.slug)}
                className="focus-brand flex items-center gap-2 rounded-[4px] bg-white/20 px-6 py-3 text-[15px] font-semibold text-white backdrop-blur-sm transition duration-200 hover:bg-white/30 active:scale-[0.98]"
              >
                <InfoIcon width={20} height={20} />
                More Info
              </button>
              <button
                type="button"
                aria-label={saved ? "Remove from My List" : "Add to My List"}
                onClick={() => {
                  toggleList(active.slug);
                  toast(saved ? "Removed from My List" : "Added to My List");
                }}
                className={cn(
                  "focus-brand grid h-11 w-11 place-items-center rounded-full border transition duration-200",
                  saved
                    ? "border-white bg-white text-black"
                    : "border-white/50 bg-black/40 text-white hover:border-white hover:bg-white/15",
                )}
              >
                {saved ? <CheckIcon width={19} height={19} /> : <PlusIcon width={19} height={19} />}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* maturity bar */}
      <div className="absolute bottom-[19%] right-0 z-10 hidden items-center gap-3 border-l-2 border-white/70 bg-black/40 py-2 pl-3 pr-8 text-[13px] text-white/85 md:flex">
        <span className="rounded border border-white/50 px-1.5 py-[1px] text-[11px]">{active.maturity}</span>
        <span className="max-w-[240px] text-white/70">
          {active.genres.join(" · ")} · {active.format}
        </span>
      </div>

      {/* rotation indicators — vertical stack on the right edge */}
      <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-2 md:right-6">
        {features.map((f, i) => (
          <button
            key={f.slug}
            type="button"
            aria-label={`Show ${f.name}`}
            onClick={() => go(i)}
            className={cn(
              "rounded-full transition-all duration-300",
              i === index ? "h-8 w-[3px] bg-white" : "h-3 w-[3px] bg-white/30 hover:bg-white/60",
            )}
          />
        ))}
      </div>
    </section>
  );
}
