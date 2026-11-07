"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Artwork } from "@/components/artwork";
import { ShelfStrip } from "@/components/shelf-strip";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlayIcon,
  PlusIcon,
  ThumbUpIcon,
} from "@/components/icons";
import { useStore } from "@/components/store";
import { getTitle, shortMeta, topTen } from "@/lib/catalog";
import type { Row as RowType, Title } from "@/lib/types";
import { cn } from "@/lib/cn";

export function Row({ row, priority = false }: { row: RowType; priority?: boolean }) {
  const items = (row.ranked ? topTen() : row.slugs.map(getTitle).filter(Boolean)) as Title[];
  if (!items.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      className="row-shell group/row relative py-3 md:py-4"
    >
      <div className="mb-2 flex items-baseline gap-3 px-4 md:px-12">
        <h2 className="text-[15px] font-semibold tracking-wide text-[#e5e5e5] transition-colors hover:text-white md:text-[19px]">
          {row.title}
        </h2>
        {row.hint && (
          <span className="hidden text-[11px] uppercase tracking-[0.16em] text-white/35 sm:block">
            {row.hint}
          </span>
        )}
        <Link
          href={row.ranked ? "/new-popular" : "/browse"}
          className="ml-auto flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#54b9c5] opacity-0 transition-all duration-300 group-hover/row:opacity-100"
        >
          Explore All
          <ChevronRightIcon width={14} height={14} />
        </Link>
      </div>

      <ShelfStrip label={row.title}>
        {items.map((title, i) => (
          <div key={`${row.id}-${title.slug}`} className="snap-start">
            <PosterCard
              title={title}
              rank={row.ranked ? i + 1 : undefined}
              priority={priority && i < 4}
            />
          </div>
        ))}
      </ShelfStrip>
    </motion.section>
  );
}

export function ContinueRow({
  slugs,
  title = "Continue Watching",
  hint = "Pick up where you left off",
  showProgress = true,
}: {
  slugs: string[];
  title?: string;
  hint?: string;
  showProgress?: boolean;
}) {
  const items = slugs.map(getTitle).filter(Boolean) as Title[];
  const { progress } = useStore();

  if (!items.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      className="row-shell group/row relative py-3 md:py-4"
    >
      <div className="mb-2 flex items-baseline gap-3 px-4 md:px-12">
        <h2 className="text-[15px] font-semibold tracking-wide text-[#e5e5e5] md:text-[19px]">
          {title}
        </h2>
        <span className="hidden text-[11px] uppercase tracking-[0.16em] text-white/35 sm:block">
          {hint}
        </span>
      </div>

      <ShelfStrip label={title}>
        {items.map((item) => {
          const p = progress[item.slug];
          const percent = p?.percent;
          const label = p
            ? item.kind === "series"
              ? `S${p.season}:E${p.episode}`
              : `${Math.round(p.percent * 100)}% watched`
            : undefined;
          return (
            <div key={item.slug} className="snap-start">
              <PosterCard
                title={item}
                progress={showProgress ? percent : undefined}
                progressLabel={showProgress ? label : undefined}
              />
            </div>
          );
        })}
      </ShelfStrip>
    </motion.section>
  );
}

export function PosterCard({
  title,
  rank,
  progress,
  progressLabel,
  priority,
  expand = true,
}: {
  title: Title;
  rank?: number;
  progress?: number;
  progressLabel?: string;
  priority?: boolean;
  expand?: boolean;
}) {
  const router = useRouter();
  const { openTitle, inList, toggleList, toast, settings } = useStore();
  const [hovered, setHovered] = useState(false);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const [preview, setPreview] = useState<{ left: number; top: number; width: number } | null>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (showTimer.current) window.clearTimeout(showTimer.current);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  const openPreview = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width * 1.75, 300), 360);
    const height = width * 1.18;
    const centered = rect.left + rect.width / 2 - width / 2;
    const left = Math.min(Math.max(centered, 12), window.innerWidth - width - 12);
    const above = rect.top > height + 24;
    const top = above ? rect.top - height + 18 : rect.bottom - 12;
    setPreview({ left, top, width });
    setHovered(true);
  }, []);

  const scheduleOpen = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse" || !expand || !settings.hoverPreviews) return;
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (showTimer.current) window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(openPreview, 420);
  };

  const scheduleClose = () => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHovered(false), 160);
  };

  const keepOpen = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
  };

  const saved = inList(title.slug);

  return (
    <div className="relative flex items-end">
      {rank && (
        <span
          aria-hidden
          className="rank-numeral pointer-events-none -mr-4 w-[64px] shrink-0 select-none text-[92px] md:-mr-6 md:w-[86px] md:text-[122px]"
        >
          {rank}
        </span>
      )}

      <button
        ref={cardRef}
        type="button"
        onPointerEnter={scheduleOpen}
        onPointerLeave={scheduleClose}
        onClick={() => openTitle(title.slug)}
        className={cn(
          "group relative block shrink-0 snap-start overflow-hidden rounded-[4px] bg-[#222] text-left ring-1 ring-white/5 transition-[transform,box-shadow,ring] duration-300 will-change-transform",
          "w-[var(--nf-card-w,186px)]",
          "aspect-[2/3] hover:z-10 hover:scale-[1.05] hover:ring-white/30 hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.9)]",
        )}
      >
        <Artwork
          slug={title.slug}
          name={title.name}
          accent={title.accent}
          priority={priority}
          sizes="(max-width: 640px) 130px, (max-width: 1280px) 165px, 190px"
        />

        {title.badge && (
          <span className="absolute left-1.5 top-1.5 rounded-sm bg-netflix-red px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white shadow">
            {title.badge}
          </span>
        )}

        {/* caption + meta — revealed on hover */}
        <span
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/95 via-black/55 to-transparent p-2 pt-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
            progress !== undefined && "pb-6",
          )}
        >
          <span className="line-clamp-2 text-[11.5px] font-semibold leading-tight text-white poster-caption">
            {title.name}
          </span>
          <span className="text-[9.5px] uppercase tracking-[0.12em] text-white/55">
            {shortMeta(title)}
          </span>
        </span>

        {/* always-visible resume progress */}
        {progress !== undefined && (
          <span className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center gap-1.5">
            <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full rounded-full bg-netflix-red"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </span>
            <span className="text-[9px] font-medium uppercase tracking-wide text-white/65">
              {progressLabel}
            </span>
          </span>
        )}
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {hovered && preview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 6 }}
                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                onPointerEnter={keepOpen}
                onPointerLeave={scheduleClose}
                style={{ left: preview.left, top: preview.top, width: preview.width }}
                className="fixed z-[60] overflow-hidden rounded-md bg-[#181818] shadow-[0_26px_60px_-10px_rgba(0,0,0,0.95)] ring-1 ring-white/10"
              >
                <button
                  type="button"
                  onClick={() => {
                    setHovered(false);
                    openTitle(title.slug);
                  }}
                  className="relative block aspect-video w-full overflow-hidden text-left"
                >
                  <span className="absolute inset-0 scale-125 opacity-70 blur-md">
                    <Artwork slug={title.slug} name={title.name} accent={title.accent} sizes="360px" />
                  </span>
                  <span
                    className="absolute inset-0"
                    style={{
                      background: `radial-gradient(120% 100% at 50% 0%, ${title.accent}44, #0b0b0b 85%)`,
                    }}
                  />
                  <span className="relative flex h-full w-full items-end p-3">
                    <span className="block">
                      <span className="block font-display text-[19px] leading-tight tracking-wide text-white">
                        {title.name}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[10.5px] text-white/70">
                        <span className="font-semibold text-[#46d369]">{title.match}% Match</span>
                        <span className="rounded border border-white/40 px-1 text-[9px]">
                          {title.maturity}
                        </span>
                        <span>{shortMeta(title)}</span>
                      </span>
                    </span>
                  </span>
                </button>

                <div className="flex items-center gap-2 px-3 pb-1 pt-3">
                  <button
                    type="button"
                    onClick={() => router.push(`/watch/${title.kind}/${title.slug}`)}
                    aria-label={`Play ${title.name}`}
                    className="grid h-8 w-8 place-items-center rounded-full bg-white text-black transition hover:bg-white/80"
                  >
                    <PlayIcon width={14} height={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toggleList(title.slug);
                      toast(saved ? "Removed from My List" : "Added to My List");
                    }}
                    aria-label={saved ? "Remove from My List" : "Add to My List"}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-full border transition",
                      saved
                        ? "border-white bg-white text-black"
                        : "border-white/40 text-white hover:border-white",
                    )}
                  >
                    {saved ? <CheckIcon width={14} height={14} /> : <PlusIcon width={14} height={14} />}
                  </button>
                  <button
                    type="button"
                    aria-label="Like"
                    onClick={() => toast(`We'll show you more like ${title.name}`)}
                    className="grid h-8 w-8 place-items-center rounded-full border border-white/40 text-white transition hover:border-white"
                  >
                    <ThumbUpIcon width={14} height={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="More info"
                    onClick={() => {
                      setHovered(false);
                      openTitle(title.slug);
                    }}
                    className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-white/40 text-white transition hover:border-white"
                  >
                    <ChevronDownIcon width={15} height={15} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pb-3 pt-2 text-[11px] text-white/70">
                  {title.genres.slice(0, 3).map((g, i) => (
                    <span key={g} className="flex items-center gap-2">
                      {i > 0 && <span className="h-[3px] w-[3px] rounded-full bg-white/40" />}
                      {g}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

/** Plain tile used in dense grids (search, genre, my list, similar titles). */
export function PosterTile({ title, className }: { title: Title; className?: string }) {
  const { openTitle } = useStore();
  return (
    <button
      type="button"
      onClick={() => openTitle(title.slug)}
      className={cn(
        "group relative aspect-[2/3] w-full overflow-hidden rounded-[4px] bg-[#222] text-left ring-1 ring-white/5 transition duration-300 will-change-transform hover:z-10 hover:scale-[1.03] hover:ring-white/40",
        className,
      )}
    >
      <Artwork slug={title.slug} name={title.name} accent={title.accent} sizes="(max-width: 768px) 30vw, 200px" />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent p-2 pt-10 opacity-0 transition duration-300 group-hover:opacity-100">
        <span className="block truncate text-[11.5px] font-semibold text-white">{title.name}</span>
        <span className="block text-[9.5px] uppercase tracking-[0.1em] text-white/55">
          {shortMeta(title)}
        </span>
      </span>
    </button>
  );
}
