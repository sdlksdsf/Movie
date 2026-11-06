"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Artwork } from "@/components/artwork";
import {
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  PlayIcon,
  PlusIcon,
  ThumbUpIcon,
  VolumeIcon,
} from "@/components/icons";
import { useStore } from "@/components/store";
import { PosterTile } from "@/components/row";
import {
  formatRuntime,
  getTitle,
  seasonsFor,
  shortMeta,
  similarTo,
} from "@/lib/catalog";
import { cn } from "@/lib/cn";

export function TitleModal() {
  const { activeSlug, openTitle } = useStore();
  const title = activeSlug ? getTitle(activeSlug) : undefined;

  return (
    <AnimatePresence>
      {title && <ModalBody key={title.slug} title={title} onClose={() => openTitle(null)} />}
    </AnimatePresence>
  );
}

function ModalBody({
  title,
  onClose,
}: {
  title: NonNullable<ReturnType<typeof getTitle>>;
  onClose: () => void;
}) {
  const router = useRouter();
  const { inList, toggleList, toast } = useStore();
  const [season, setSeason] = useState(1);
  const [showSeasons, setShowSeasons] = useState(false);
  const seasons = useMemo(() => seasonsFor(title), [title]);
  const similar = useMemo(() => similarTo(title, 9), [title]);
  const saved = inList(title.slug);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const current = seasons.find((s) => s.number === season) ?? seasons[0];

  const play = (opts?: { season?: number; episode?: number }) => {
    const s = opts?.season ?? 1;
    const e = opts?.episode ?? 1;
    onClose();
    router.push(
      title.kind === "series"
        ? `/watch/series/${title.slug}?s=${s}&e=${e}`
        : `/watch/movie/${title.slug}`,
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-black/75 px-0 py-0 backdrop-blur-sm md:px-4 md:py-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title.name}
    >
      <motion.div
        initial={{ opacity: 0, y: 34, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative mx-auto w-full max-w-[880px] overflow-hidden rounded-none bg-[#181818] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] md:rounded-lg"
      >
        {/* header */}
        <div className="relative h-[300px] w-full overflow-hidden md:h-[420px]">
          <div className="absolute inset-0 scale-110 opacity-60 blur-[2px]">
            <Artwork slug={title.slug} name={title.name} kind="backdrop" accent={title.accent} priority sizes="900px" />
          </div>
          <div className="absolute inset-0">
            <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${title.accent}33, transparent 65%)` }} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#181818]/90 via-transparent to-transparent" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-brand absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-[#181818]/90 text-white transition hover:bg-black"
          >
            <CloseIcon width={20} height={20} />
          </button>

          <div className="absolute inset-x-0 bottom-0 z-10 p-5 md:p-9">
            <h2 className="max-w-[540px] font-display text-[clamp(2rem,5vw,3.4rem)] leading-[0.95] text-white drop-shadow-lg">
              {title.name}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => play()}
                className="focus-brand flex items-center gap-2 rounded-[4px] bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/85 active:scale-[0.98]"
              >
                <PlayIcon width={18} height={18} />
                Play
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleList(title.slug);
                  toast(saved ? "Removed from My List" : "Added to My List");
                }}
                aria-label={saved ? "Remove from My List" : "Add to My List"}
                className={cn(
                  "focus-brand grid h-10 w-10 place-items-center rounded-full border-2 transition",
                  saved
                    ? "border-white bg-white text-black"
                    : "border-white/50 text-white hover:border-white",
                )}
              >
                {saved ? <CheckIcon width={18} height={18} /> : <PlusIcon width={18} height={18} />}
              </button>
              <button
                type="button"
                aria-label="Like"
                onClick={() => toast("Rated — we'll tune your recommendations")}
                className="focus-brand grid h-10 w-10 place-items-center rounded-full border-2 border-white/50 text-white transition hover:border-white"
              >
                <ThumbUpIcon width={18} height={18} />
              </button>
              <button
                type="button"
                aria-label="Mute"
                onClick={() => toast("Audio is controlled inside the player")}
                className="focus-brand ml-auto grid h-10 w-10 place-items-center rounded-full border-2 border-white/50 text-white transition hover:border-white"
              >
                <VolumeIcon width={18} height={18} />
              </button>
            </div>
          </div>
        </div>

        {/* meta + copy */}
        <div className="grid gap-6 px-5 pb-6 pt-4 md:grid-cols-[1.6fr_1fr] md:px-9">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-[13px]">
              <span className="font-semibold text-[#46d369]">{title.match}% Match</span>
              <span className="text-white/80">{title.year}</span>
              <span className="rounded border border-white/40 px-1.5 py-[1px] text-[11px] uppercase text-white/80">
                {title.maturity}
              </span>
              <span className="text-white/80">
                {title.kind === "movie" ? formatRuntime(title.runtime) : `${title.seasons} Season${(title.seasons ?? 1) > 1 ? "s" : ""}`}
              </span>
              <span className="rounded bg-white/15 px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wider text-white/80">
                HD
              </span>
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-netflix-red">
              {title.tagline}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-[#d2d2d2]">{title.overview}</p>
          </div>

          <div className="space-y-3 text-[13px] leading-relaxed">
            <p>
              <span className="text-white/45">Cast: </span>
              <span className="text-white/85">{title.cast.join(", ")}</span>
            </p>
            <p>
              <span className="text-white/45">Creator: </span>
              <span className="text-white/85">{title.creator}</span>
            </p>
            <p>
              <span className="text-white/45">Genres: </span>
              <span className="text-white/85">{title.genres.join(", ")}</span>
            </p>
            <p>
              <span className="text-white/45">This {title.kind === "series" ? "show" : "film"} is: </span>
              <span className="text-white/85">
                {title.genres.slice(0, 2).join(", ")} · {title.maturity} rated
              </span>
            </p>
          </div>
        </div>

        {/* episodes */}
        {title.kind === "series" && seasons.length > 0 && (
          <div className="px-5 pb-2 md:px-9">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[19px] font-semibold text-white">Episodes</h3>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSeasons((v) => !v)}
                  className="flex items-center gap-2 rounded border border-white/30 bg-black/40 px-3 py-1.5 text-[13px] text-white transition hover:border-white"
                >
                  Season {season}
                  <ChevronDownIcon width={14} height={14} />
                </button>
                <AnimatePresence>
                  {showSeasons && (
                    <motion.ul
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="absolute right-0 top-10 z-20 w-40 overflow-hidden rounded border border-white/15 bg-[#1f1f1f] py-1 text-sm shadow-2xl"
                    >
                      {seasons.map((s) => (
                        <li key={s.number}>
                          <button
                            type="button"
                            onClick={() => {
                              setSeason(s.number);
                              setShowSeasons(false);
                            }}
                            className={cn(
                              "block w-full px-4 py-2 text-left transition hover:bg-white/10",
                              s.number === season ? "text-white" : "text-white/70",
                            )}
                          >
                            Season {s.number}
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <ul className="divide-y divide-white/10 border-t border-white/10">
              {current?.episodes.map((ep) => (
                <li key={ep.number}>
                  <button
                    type="button"
                    onClick={() => play({ season, episode: ep.number })}
                    className="group flex w-full items-center gap-4 px-1 py-4 text-left transition hover:bg-white/[0.04]"
                  >
                    <span className="w-5 shrink-0 text-center text-sm text-white/50">{ep.number}</span>
                    <span className="relative h-12 w-[84px] shrink-0 overflow-hidden rounded bg-[#222] md:h-14 md:w-[100px]">
                      <span className="absolute inset-0 opacity-70">
                        <Artwork slug={title.slug} name="" accent={title.accent} sizes="120px" />
                      </span>
                      <span className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition group-hover:opacity-100">
                        <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white text-white">
                          <PlayIcon width={12} height={12} />
                        </span>
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[13.5px] font-medium text-white">{ep.name}</span>
                        <span className="shrink-0 text-[12px] text-white/50">{ep.runtime}m</span>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[12px] leading-relaxed text-white/55">
                        {ep.overview}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* more like this */}
        <div className="px-5 pb-10 pt-6 md:px-9">
          <h3 className="mb-4 text-[19px] font-semibold text-white">More Like This</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {similar.slice(0, 6).map((s) => (
              <SimilarCard key={s.slug} slug={s.slug} />
            ))}
          </div>
        </div>

        {/* about */}
        <div className="border-t border-white/10 px-5 py-6 md:px-9">
          <h3 className="mb-3 text-[17px] font-semibold text-white">
            About <span className="font-display tracking-wide">{title.name}</span>
          </h3>
          <div className="grid gap-2 text-[13px] sm:grid-cols-2">
            <p>
              <span className="text-white/45">Director / Creator: </span>
              <span className="text-white/85">{title.creator}</span>
            </p>
            <p>
              <span className="text-white/45">Cast: </span>
              <span className="text-white/85">{title.cast.join(", ")}</span>
            </p>
            <p>
              <span className="text-white/45">Audio: </span>
              <span className="text-white/85">English, Hindi, Spanish — Audio Description available</span>
            </p>
            <p>
              <span className="text-white/45">Subtitles: </span>
              <span className="text-white/85">English, اردو, हिन्दी, Español</span>
            </p>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-white/30">
            Demo project. Metadata and artwork belong to their respective owners; streaming is
            provided by the third-party frameXTV embed.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SimilarCard({ slug }: { slug: string }) {
  const { openTitle } = useStore();
  const t = getTitle(slug);
  if (!t) return null;
  return (
    <div className="overflow-hidden rounded bg-[#232323]">
      <div className="relative aspect-video">
        <PosterTile title={t} className="absolute inset-0 h-full w-full !aspect-auto" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#232323] via-transparent to-transparent" />
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-medium text-white">{t.name}</span>
          <span className="shrink-0 text-[11px] font-semibold text-[#46d369]">{t.match}%</span>
        </div>
        <p className="mt-1 text-[10.5px] text-white/45">
          {t.year} · {shortMeta(t)} · {t.maturity}
        </p>
        <p className="mt-2 line-clamp-3 text-[11.5px] leading-relaxed text-white/65">{t.overview}</p>
        <button
          type="button"
          onClick={() => openTitle(t.slug)}
          className="mt-3 w-full rounded bg-white/10 py-1.5 text-[11.5px] font-medium text-white transition hover:bg-white/20"
        >
          View details
        </button>
      </div>
    </div>
  );
}
