"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  NextIcon,
  PlayIcon,
  SparkIcon,
} from "@/components/icons";
import { useStore } from "@/components/store";
import { Wordmark } from "@/components/wordmark";
import { Artwork } from "@/components/artwork";
import { shortMeta } from "@/lib/catalog";
import { moreLikeThis } from "@/lib/taste";
import type { Season, Title } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * One player, one set of controls.
 *
 * The stream is a third-party iframe (CineLite) that owns playback: play/pause,
 * seek, volume, subtitles, audio track, cast and fullscreen all live in *its*
 * bottom bar. We deliberately do not re-implement those, because a cross-origin
 * iframe can't be controlled that way — that's what produced the "two players"
 * look before.
 *
 * Our layer only does the things the embed cannot:
 *   back navigation · which server · default quality (URL param) · episodes
 */

type ServerId = "viper" | "archer";
const SERVERS: Array<{ id: ServerId; label: string; hint: string }> = [
  { id: "viper", label: "Viper", hint: "CineLite · 4K + subtitles" },
  { id: "archer", label: "Archer", hint: "FrameXTV · backup" },
];

const QUALITIES = ["4k", "1080p", "720p", "480p"] as const;
type Quality = (typeof QUALITIES)[number];

const ACCENT = "e50914";

const ls = {
  get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};

function buildSrc(o: {
  server: ServerId;
  title: Title;
  season: number;
  episode: number;
  quality: Quality;
  resumeAt: number | null;
}) {
  const { server, title, season, episode, quality, resumeAt } = o;

  if (server === "viper") {
    // /{tmdbId} for films · /tv/{tmdbId}/{s}/{e} · /anime/{anilistId}/{ep}
    const base = title.anilistId
      ? `https://embed.cinelite.xyz/anime/${title.anilistId}/${episode}`
      : title.kind === "series"
        ? `https://embed.cinelite.xyz/tv/${title.tmdbId}/${season}/${episode}`
        : `https://embed.cinelite.xyz/${title.tmdbId}`;

    const params = new URLSearchParams();
    params.set("color", ACCENT);
    params.set("suggestionui", "false");
    params.set("quality", quality);
    params.set("autoplay", "1");
    if (resumeAt && resumeAt > 20) params.set("t", String(Math.floor(resumeAt)));
    return `${base}?${params.toString()}`;
  }

  const base =
    title.kind === "series"
      ? `https://framextv.xyz/embed/${title.tmdbId}/${season}/${episode}`
      : `https://framextv.xyz/embed/${title.tmdbId}`;
  const params = new URLSearchParams();
  params.set("autoplay", "1");
  params.set("muted", "0");
  params.set("controls", "1");
  if (resumeAt && resumeAt > 20) params.set("t", String(Math.floor(resumeAt)));
  return `${base}?${params.toString()}`;
}

export function Player({
  title,
  initialSeason,
  initialEpisode,
  seasons,
}: {
  title: Title;
  initialSeason: number;
  initialEpisode: number;
  seasons: Season[];
  artwork?: { poster?: string; backdrop?: string };
}) {
  const router = useRouter();
  const { setProgress, progress, toast } = useStore();

  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [server, setServer] = useState<ServerId>("viper");
  const [quality, setQuality] = useState<Quality>("1080p");
  const [menu, setMenu] = useState<null | "settings" | "episodes">(null);
  const [chrome, setChrome] = useState(true);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hideTimer = useRef<number | null>(null);
  const savedAt = useRef(0);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const loadedRef = useRef(false);
  const lastTime = useRef(0);
  const stillHits = useRef(0);
  const pauseTimer = useRef<number | null>(null);
  const triedFallback = useRef(false);

  /* restore preferences */
  useEffect(() => {
    const q = ls.get("nf.quality") as Quality | null;
    const best = ls.get("nf.server.best") as ServerId | null;
    const s = ls.get("nf.server") as ServerId | null;
    if (q && QUALITIES.includes(q)) setQuality(q);
    if (best && SERVERS.some((x) => x.id === best)) setServer(best);
    else if (s && SERVERS.some((x) => x.id === s)) setServer(s);
  }, []);

  /**
   * The embed URL is derived from nothing but [server, quality, season, episode].
   * Playback telemetry is read through a ref, so it can never remount the frame
   * (that was the endless "connecting" loop).
   */
  const src = useMemo(() => {
    const stored = progressRef.current[title.slug];
    const sameEpisode = stored && stored.season === season && stored.episode === episode;
    const resumeAt =
      sameEpisode && stored.percent > 0.02 && stored.percent < 0.95 && stored.seconds
        ? stored.seconds
        : null;
    return buildSrc({ server, title, season, episode, quality, resumeAt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, quality, title.tmdbId, title.kind, title.anilistId, season, episode]);

  const suggestions = useMemo(() => moreLikeThis(title, progress, 6), [title, progress]);

  /** a progress tick that doesn't advance the clock means the user paused */
  const trackPlayState = useCallback((current: number) => {
    const delta = current - lastTime.current;
    lastTime.current = current;

    if (delta > 0.4) {
      stillHits.current = 0;
      if (pauseTimer.current) window.clearTimeout(pauseTimer.current);
      setPaused(false);
      return;
    }

    if (current <= 1) return;
    if (pauseTimer.current) window.clearTimeout(pauseTimer.current);
    pauseTimer.current = window.setTimeout(() => {
      stillHits.current += 1;
      if (stillHits.current >= 1) {
        setPaused(true);
        setShowSuggestions(true);
      }
    }, 1000);
  }, []);

  const currentSeason = seasons.find((s) => s.number === season);
  const hasNext =
    title.kind === "series" && Boolean(currentSeason && episode < (currentSeason.episodes.length ?? 0));

  /* chrome auto-hide */
  const poke = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChrome(false), 3200);
  }, []);

  useEffect(() => {
    poke();
    const onMove = () => poke();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchstart", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onMove);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [poke]);

  useEffect(() => {
    if (menu) {
      setChrome(true);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    } else {
      poke();
    }
  }, [menu, poke]);

  /* fall back only when the frame never loads — never interrupt a live stream */
  const fallbackServer = useCallback(() => {
    if (triedFallback.current) return;
    triedFallback.current = true;
    const other: ServerId = server === "viper" ? "archer" : "viper";
    setServer(other);
    ls.set("nf.server", other);
    toast(`No signal — switched to ${other === "viper" ? "Viper" : "Archer"}`);
  }, [server, toast]);

  useEffect(() => {
    setStarted(false);
    setPaused(false);
    lastTime.current = 0;
    stillHits.current = 0;
    loadedRef.current = false;
    const quick = window.setTimeout(() => setStarted(true), 1800);
    const silent = window.setTimeout(() => {
      if (!loadedRef.current) fallbackServer();
    }, 7000);
    return () => {
      window.clearTimeout(quick);
      window.clearTimeout(silent);
    };
  }, [src, fallbackServer]);

  /* progress + resume, from either provider */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "CINELITE_EXIT_PLAYER") {
        router.back();
        return;
      }

      if (data.event === "frameXTV:timeupdate") {
        const current = Number(data.currentTime) || 0;
        const total = Number(data.duration) || 0;
        setStarted(true);
        trackPlayState(current);
        const now = Date.now();
        if (now - savedAt.current > 4000 && total) {
          savedAt.current = now;
          setProgress(title.slug, {
            season,
            episode,
            percent: Math.min(1, current / total),
            seconds: current,
            duration: total,
            updated: now,
          });
        }
        return;
      }

      if (data.type !== "CINELITE_PLAYBACK_PROGRESS") return;

      const p = (data.payload ?? {}) as {
        currentTime?: number;
        duration?: number;
        progress?: number;
        completed?: boolean;
        season?: number | null;
        episode?: number | null;
      };
      const current = Number(p.currentTime) || 0;
      const total = Number(p.duration) || 0;
      const pct = Number(p.progress ?? (total ? (current / total) * 100 : 0)) || 0;
      setStarted(true);
      trackPlayState(current);

      const now = Date.now();
      if (now - savedAt.current > 4000 || p.completed) {
        savedAt.current = now;
        setProgress(title.slug, {
          season: p.season ?? season,
          episode: p.episode ?? episode,
          percent: p.completed ? 1 : Math.min(1, pct / 100),
          seconds: current,
          duration: total,
          updated: now,
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router, setProgress, title.slug, season, episode, trackPlayState]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (event.key === "Escape") {
        if (menu) setMenu(null);
        else router.back();
      }
      if (event.key.toLowerCase() === "n" && hasNext) setEpisode((e) => e + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, router, hasNext]);

  const changeServer = (next: ServerId) => {
    setServer(next);
    triedFallback.current = false;
    ls.set("nf.server", next);
    ls.set("nf.server.best", next);
    toast(`Server · ${SERVERS.find((s) => s.id === next)?.label}`);
    setMenu(null);
  };

  const changeQuality = (next: Quality) => {
    setQuality(next);
    ls.set("nf.quality", next);
    toast(`Restarting in ${next.toUpperCase()}`);
    setMenu(null);
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      <iframe
        ref={iframeRef}
        src={src}
        title={`${title.name} · NOFLIX`}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture; presentation"
        allowFullScreen
        referrerPolicy="origin"
        onLoad={() => {
          loadedRef.current = true;
          ls.set("nf.server.best", server);
          window.setTimeout(() => setStarted(true), 400);
        }}
        className="absolute inset-0 h-full w-full border-0"
      />

      {/* everything here is click-through; only the actual buttons take input */}
      <div className="pointer-events-none absolute inset-0">
        {/* loading hint — small, top centre, gone in <2s */}
        <AnimatePresence>
          {!started && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="absolute left-1/2 top-4 z-30 -translate-x-1/2"
            >
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/65 px-3 py-1.5 backdrop-blur-md">
                <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-white/25 border-t-[#e50914]" />
                <span className="text-[11px] font-medium text-white/80">Starting stream…</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* top-left: back + title, auto-hiding, small */}
        <AnimatePresence>
          {chrome && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="absolute left-3 top-3 z-20 flex items-center gap-2 md:left-5 md:top-4"
            >
              <button
                type="button"
                onClick={() => router.back()}
                aria-label="Back"
                className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white/90 backdrop-blur-md transition hover:bg-black/75 hover:text-white"
              >
                <ArrowLeftIcon width={20} height={20} />
              </button>

              <div className="pointer-events-none max-w-[46vw] rounded-full bg-black/55 px-3 py-1.5 backdrop-blur-md">
                <p className="truncate text-[12.5px] font-semibold leading-tight text-white">{title.name}</p>
                <p className="truncate text-[10.5px] leading-tight text-white/55">
                  {title.kind === "series" ? `S${season} · E${episode}` : `${title.year} · ${title.maturity}`}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* top-right: one menu button for the things the embed can't do */}
        <AnimatePresence>
          {chrome && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
              className="absolute right-3 top-3 z-20 flex items-center gap-2 md:right-5 md:top-4"
            >
              {hasNext && (
                <button
                  type="button"
                  onClick={() => setEpisode((e) => e + 1)}
                  aria-label="Next episode"
                  className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white/90 backdrop-blur-md transition hover:bg-black/75 hover:text-white"
                >
                  <NextIcon width={18} height={18} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setMenu(menu === "settings" ? null : "settings")}
                aria-label="Player options"
                className={cn(
                  "pointer-events-auto grid h-10 w-10 place-items-center rounded-full backdrop-blur-md transition",
                  menu
                    ? "bg-white text-black"
                    : "bg-black/55 text-white/90 hover:bg-black/75 hover:text-white",
                )}
              >
                <SparkIcon width={18} height={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* options panel */}
        <AnimatePresence>
          {menu === "settings" && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-auto absolute right-3 top-16 z-30 w-[268px] overflow-hidden rounded-xl border border-white/10 bg-[#141414]/97 p-1.5 shadow-2xl backdrop-blur-xl md:right-5"
            >
              <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Server
              </p>
              {SERVERS.map((item) => (
                <Row
                  key={item.id}
                  active={server === item.id}
                  title={item.label}
                  subtitle={item.hint}
                  onClick={() => changeServer(item.id)}
                />
              ))}

              <p className="mt-1 px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Default quality
              </p>
              {QUALITIES.map((item) => (
                <Row
                  key={item}
                  active={quality === item}
                  title={item.toUpperCase()}
                  subtitle={item === quality ? "Reloads the stream in this quality" : undefined}
                  onClick={() => changeQuality(item)}
                />
              ))}

              {title.kind === "series" && currentSeason && (
                <>
                  <p className="mt-1 px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    Season {season}
                  </p>
                  <div className="max-h-[180px] overflow-y-auto">
                    {currentSeason.episodes.map((item) => (
                      <Row
                        key={item.number}
                        active={episode === item.number}
                        title={`E${item.number} · ${item.name}`}
                        subtitle={`${item.runtime} min`}
                        onClick={() => {
                          setEpisode(item.number);
                          setMenu(null);
                        }}
                      />
                    ))}
                  </div>
                </>
              )}

              <p className="mt-1 border-t border-white/10 px-2.5 pb-2 pt-2 text-[10.5px] leading-relaxed text-white/35">
                Subtitles, audio track, quality switching and fullscreen are in the player&apos;s own bar at
                the bottom.
              </p>
            </motion.div>
          )}
        </AnimatePresence>


        {/* pause suggestions — Netflix-style rail, sits clear of the player's own bar */}
        <AnimatePresence>
          {paused && showSuggestions && suggestions.length > 0 && (
            <motion.aside
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto absolute bottom-[92px] right-3 z-20 w-[300px] max-w-[92vw] overflow-hidden rounded-lg border border-white/10 bg-[#0d0d0d]/94 shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl md:bottom-[104px] md:right-6 md:w-[460px]"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-3.5 py-2.5">
                <div>
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.26em] text-[#e50914]">
                    Paused
                  </p>
                  <h2 className="mt-0.5 text-[13.5px] font-semibold text-white md:text-[15px]">
                    More Like This
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSuggestions(false)}
                  aria-label="Hide suggestions"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                >
                  <CloseIcon width={14} height={14} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 p-2 md:gap-2 md:p-2.5">
                {suggestions.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => router.push(`/watch/${item.kind}/${item.slug}`)}
                    className="group relative overflow-hidden rounded-[4px] bg-[#1b1b1b] text-left ring-1 ring-white/5 transition duration-200 hover:z-10 hover:ring-white/40"
                  >
                    <span className="relative block aspect-[2/3] w-full overflow-hidden">
                      <Artwork
                        slug={item.slug}
                        name={item.name}
                        accent={item.accent}
                        sizes="(max-width: 768px) 30vw, 150px"
                      />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                      <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
                        <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-black/40 text-white">
                          <PlayIcon width={13} height={13} />
                        </span>
                      </span>
                      <span className="absolute left-1 top-1 rounded-sm bg-black/70 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/85">
                        {item.kind === "series" ? "Series" : "Film"}
                      </span>
                    </span>
                    <span className="block px-1.5 pb-1.5 pt-1">
                      <span className="block truncate text-[10.5px] font-medium leading-tight text-white/90">
                        {item.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[9px] text-white/45">
                        <span className="font-semibold text-[#46d369]">{item.match}% match</span>
                        <span>·</span>
                        <span className="truncate">{shortMeta(item)}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* first-load wordmark, bottom-left, only before the stream starts */}
        <AnimatePresence>
          {!started && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-5 left-5 z-20 hidden md:block"
            >
              <Wordmark className="text-lg opacity-40" asLink={false} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Row({
  title,
  subtitle,
  active,
  onClick,
}: {
  title: React.ReactNode;
  subtitle?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition",
        active ? "bg-white/10" : "hover:bg-white/5",
      )}
    >
      <span className="grid w-4 shrink-0 place-items-center text-[#e50914]">
        {active ? <CheckIcon width={13} height={13} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[13px]", active ? "text-white" : "text-white/80")}>
          {title}
        </span>
        {subtitle && <span className="block truncate text-[11px] text-white/40">{subtitle}</span>}
      </span>
    </button>
  );
}
