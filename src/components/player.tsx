"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  CheckIcon,
  NextIcon,
  SubtitlesIcon,
  VolumeIcon,
} from "@/components/icons";
import { useStore } from "@/components/store";
import { Wordmark } from "@/components/wordmark";
import type { Season, Title } from "@/lib/types";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Embed providers                                                     */
/* ------------------------------------------------------------------ */

type ServerId = "cinelite" | "framextv";

const SERVERS: Array<{ id: ServerId; label: string; hint: string }> = [
  { id: "cinelite", label: "Viper", hint: "CineLite · 4K + subtitles" },
  { id: "framextv", label: "Archer", hint: "FrameXTV · backup stream" },
];

const QUALITIES = ["4k", "1080p", "720p", "480p"] as const;
type Quality = (typeof QUALITIES)[number];

const SUBTITLE_LANGS = [
  { id: "off", label: "Off" },
  { id: "en", label: "English" },
  { id: "ur", label: "اردو Urdu" },
  { id: "hi", label: "हिन्दी Hindi" },
  { id: "ar", label: "العربية Arabic" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
];

/** NOFLIX brand red, passed to the embed so its chrome matches our UI. */
const ACCENT = "e50914";

type BuildArgs = {
  server: ServerId;
  tmdbId: number;
  anilistId?: number;
  kind: "movie" | "series";
  season: number;
  episode: number;
  quality: Quality;
  resumeAt?: number;
  restart?: boolean;
};

function buildSrc({
  server,
  tmdbId,
  anilistId,
  kind,
  season,
  episode,
  quality,
  resumeAt,
  restart,
}: BuildArgs) {
  const params = new URLSearchParams();

  if (server === "cinelite") {
    // https://embed.cinelite.xyz/{tmdbId} | /tv/{id}/{s}/{e} | /anime/{anilistId}/{ep}
    let base: string;
    if (anilistId) base = `https://embed.cinelite.xyz/anime/${anilistId}/${episode}`;
    else if (kind === "series") base = `https://embed.cinelite.xyz/tv/${tmdbId}/${season}/${episode}`;
    else base = `https://embed.cinelite.xyz/${tmdbId}`;

    params.set("color", ACCENT);
    params.set("suggestionui", "true");
    params.set("quality", quality);
    if (restart) params.set("reset", "1");
    else if (resumeAt && resumeAt > 20) params.set("t", String(Math.floor(resumeAt)));
    return `${base}?${params.toString()}`;
  }

  const base =
    kind === "series"
      ? `https://framextv.xyz/embed/${tmdbId}/${season}/${episode}`
      : `https://framextv.xyz/embed/${tmdbId}`;
  params.set("autoplay", "1");
  params.set("muted", "0");
  params.set("controls", "1");
  if (resumeAt && resumeAt > 20) params.set("t", String(Math.floor(resumeAt)));
  return `${base}?${params.toString()}`;
}

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** Shape of the `CINELITE_PLAYBACK_PROGRESS` broadcast. */
type CineliteProgress = {
  mediaId?: string;
  isTv?: boolean;
  isAnime?: boolean;
  season?: number | null;
  episode?: number | null;
  currentTime?: number;
  duration?: number;
  progress?: number;
  completed?: boolean;
};

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
}) {
  const router = useRouter();
  const { setProgress, progress, toast } = useStore();

  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [server, setServer] = useState<ServerId>("cinelite");
  const [quality, setQuality] = useState<Quality>("1080p");
  const [subtitles, setSubtitles] = useState("en");
  const [open, setOpen] = useState<null | "server" | "quality" | "subs" | "episodes">(null);
  const [ready, setReady] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [playState, setPlayState] = useState<"playing" | "paused">("playing");
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hideTimer = useRef<number | null>(null);
  const lastSaved = useRef(0);
  const frames = useRef(0);

  /** resume point: only restore when the last watch was meaningful and unfinished */
  const stored = progress[title.slug];
  const resumeAt = useMemo(() => {
    if (!stored) return undefined;
    if (stored.season !== season || stored.episode !== episode) return undefined;
    if (stored.percent <= 0.02 || stored.percent >= 0.95) return undefined;
    return stored.seconds && stored.seconds > 20 ? stored.seconds : undefined;
  }, [stored, season, episode]);

  const [restart, setRestart] = useState(false);

  const src = useMemo(
    () =>
      buildSrc({
        server,
        tmdbId: title.tmdbId,
        anilistId: title.anilistId,
        kind: title.kind,
        season,
        episode,
        quality,
        resumeAt: restart ? undefined : resumeAt,
        restart,
      }),
    [server, title, season, episode, quality, resumeAt, restart],
  );

  const currentSeason = seasons.find((s) => s.number === season);
  const episodeMeta = currentSeason?.episodes.find((e) => e.number === episode);
  const hasNext = title.kind === "series" && Boolean(currentSeason && episode < currentSeason.episodes.length);

  /* preferences survive reloads */
  useEffect(() => {
    try {
      const savedQuality = localStorage.getItem("nf.quality") as Quality | null;
      const savedServer = localStorage.getItem("nf.server") as ServerId | null;
      const savedSubs = localStorage.getItem("nf.subs");
      if (savedQuality && QUALITIES.includes(savedQuality)) setQuality(savedQuality);
      if (savedServer && SERVERS.some((s) => s.id === savedServer)) setServer(savedServer);
      if (savedSubs) setSubtitles(savedSubs);
    } catch {
      /* ignore */
    }
  }, []);

  /* push settings into the embed */
  const syncSettings = useCallback(
    (next: { quality?: Quality; subtitles?: string }) => {
      const frame = iframeRef.current?.contentWindow;
      if (!frame) return;
      frame.postMessage(
        {
          type: "CINELITE_SYNC_SETTINGS",
          preferredQuality: next.quality ?? quality,
          subtitles: (next.subtitles ?? subtitles) !== "off",
          subtitleLanguage: (next.subtitles ?? subtitles) === "off" ? null : (next.subtitles ?? subtitles),
        },
        "*",
      );
    },
    [quality, subtitles],
  );

  useEffect(() => {
    syncSettings({});
  }, [syncSettings]);

  /** chrome auto-hide */
  const poke = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChrome(false), 3600);
  }, []);

  useEffect(() => {
    poke();
    const onMove = () => poke();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchstart", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onMove);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [poke]);

  /* keep the bar visible while a menu is open */
  useEffect(() => {
    if (open) {
      setChrome(true);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    } else {
      poke();
    }
  }, [open, poke]);

  /* ---- message bridge with the player ---- */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "CINELITE_EXIT_PLAYER") {
        router.back();
        return;
      }

      if (data.type === "CINELITE_PLAYBACK_PROGRESS") {
        const payload = (data.payload ?? {}) as CineliteProgress;
        const current = Number(payload.currentTime) || 0;
        const total = Number(payload.duration) || 0;
        const pct = Number(payload.progress ?? (total ? (current / total) * 100 : 0)) || 0;

        setPosition(current);
        if (total) setDuration(total);
        setReady(true);
        frames.current += 1;
        if (frames.current === 1) setChrome(false);

        const now = Date.now();
        if (now - lastSaved.current > 3500 || payload.completed) {
          lastSaved.current = now;
          setProgress(title.slug, {
            season: payload.season ?? season,
            episode: payload.episode ?? episode,
            percent: payload.completed ? 1 : pct / 100,
            seconds: current,
            duration: total,
            updated: now,
          });
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [title.slug, season, episode, setProgress, router]);

  /* the embed never wrote localStorage, so keep a local heartbeat for its own resumes */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (position > 0) {
        try {
          localStorage.setItem(
            `cw_${title.tmdbId}`,
            JSON.stringify({
              mediaId: String(title.tmdbId),
              isTv: title.kind === "series",
              season: title.kind === "series" ? season : null,
              episode: title.kind === "series" ? episode : null,
              currentTime: position,
              duration,
              updatedAt: Date.now(),
            }),
          );
        } catch {
          /* storage full / disabled */
        }
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [title.tmdbId, title.kind, season, episode, position, duration]);

  /* loading safety net — never leave the user staring at a spinner */
  useEffect(() => {
    setReady(false);
    frames.current = 0;
    const timer = window.setTimeout(() => setReady(true), 9000);
    return () => window.clearTimeout(timer);
  }, [src]);

  /* keyboard: only things the embed can't handle itself */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "Escape") {
        if (open) setOpen(null);
        else router.back();
      }
      if (event.key.toLowerCase() === "n" && hasNext) {
        setEpisode((e) => e + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, router, hasNext]);

  const changeQuality = (next: Quality) => {
    setQuality(next);
    setOpen(null);
    try {
      localStorage.setItem("nf.quality", next);
    } catch {
      /* ignore */
    }
    syncSettings({ quality: next });
    toast(`Video quality · ${next.toUpperCase()}`);
  };

  const changeServer = (next: ServerId) => {
    setServer(next);
    setOpen(null);
    setReady(false);
    try {
      localStorage.setItem("nf.server", next);
    } catch {
      /* ignore */
    }
    toast(`Server · ${SERVERS.find((s) => s.id === next)?.label}`);
  };

  const changeSubs = (next: string) => {
    setSubtitles(next);
    setOpen(null);
    try {
      localStorage.setItem("nf.subs", next);
    } catch {
      /* ignore */
    }
    syncSettings({ subtitles: next });
    toast(next === "off" ? "Subtitles off" : `Subtitles · ${SUBTITLE_LANGS.find((l) => l.id === next)?.label}`);
  };

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-black text-white">
      <iframe
        key={src}
        ref={iframeRef}
        src={src}
        title={`${title.name} — NOFLIX player`}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture; presentation"
        allowFullScreen
        referrerPolicy="origin"
        onLoad={() => setReady(true)}
        className="absolute inset-0 h-full w-full border-0"
      />

      {/* pointer-events-none wrapper so the embed keeps receiving clicks */}
      <div className="pointer-events-none absolute inset-0">
        {/* top scrim + bar */}
        <AnimatePresence>
          {chrome && (
            <motion.div
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.22 }}
              className="pointer-events-auto absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/85 via-black/45 to-transparent px-3 pb-14 pt-3 md:px-7 md:pt-4"
            >
              <div className="flex items-center gap-2 md:gap-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  aria-label="Back"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeftIcon width={22} height={22} />
                </button>

                <Wordmark className="hidden text-xl sm:block md:text-2xl" asLink={false} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold md:text-base">{title.name}</p>
                  <p className="truncate text-[11px] text-white/55 md:text-xs">
                    {title.kind === "series"
                      ? `S${season} · E${episode}${episodeMeta ? ` · ${episodeMeta.name}` : ""}`
                      : `${title.year} · ${title.maturity}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
                  {title.kind === "series" && seasons.length > 0 && (
                    <BarButton
                      label={`S${season} E${episode}`}
                      active={open === "episodes"}
                      onClick={() => setOpen(open === "episodes" ? null : "episodes")}
                      className="hidden sm:inline-flex"
                    />
                  )}

                  <BarButton
                    label={<><VolumeIcon width={15} height={15} /> {SERVERS.find((s) => s.id === server)?.label}</>}
                    active={open === "server"}
                    onClick={() => setOpen(open === "server" ? null : "server")}
                  />

                  <BarButton
                    label={quality.toUpperCase()}
                    active={open === "quality"}
                    onClick={() => setOpen(open === "quality" ? null : "quality")}
                    className="hidden sm:inline-flex"
                  />

                  <button
                    type="button"
                    onClick={() => setOpen(open === "subs" ? null : "subs")}
                    aria-label="Subtitles and audio"
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-md border transition",
                      subtitles === "off"
                        ? "border-white/15 text-white/50 hover:text-white"
                        : "border-white/30 text-white hover:bg-white/10",
                    )}
                  >
                    <SubtitlesIcon width={17} height={17} />
                  </button>

                  {hasNext && (
                    <button
                      type="button"
                      onClick={() => {
                        setEpisode((e) => e + 1);
                        setReady(false);
                      }}
                      aria-label="Next episode"
                      className="grid h-9 w-9 place-items-center rounded-md border border-white/15 text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                      <NextIcon width={17} height={17} />
                    </button>
                  )}
                </div>
              </div>

              {/* menus */}
              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-3 top-[62px] z-30 w-[268px] overflow-hidden rounded-lg border border-white/10 bg-[#141414]/95 p-1.5 shadow-2xl backdrop-blur-xl md:right-7"
                  >
                    {open === "server" && (
                      <>
                        <MenuTitle>Streaming server</MenuTitle>
                        {SERVERS.map((item) => (
                          <MenuRow
                            key={item.id}
                            active={server === item.id}
                            onClick={() => changeServer(item.id)}
                            title={item.label}
                            subtitle={item.hint}
                          />
                        ))}
                      </>
                    )}

                    {open === "quality" && (
                      <>
                        <MenuTitle>Video quality</MenuTitle>
                        {QUALITIES.map((item) => (
                          <MenuRow
                            key={item}
                            active={quality === item}
                            onClick={() => changeQuality(item)}
                            title={item.toUpperCase()}
                            subtitle={item === "4k" ? "Ultra HD, data heavy" : item === "1080p" ? "Recommended" : "Lower data"}
                          />
                        ))}
                      </>
                    )}

                    {open === "subs" && (
                      <>
                        <MenuTitle>Subtitles</MenuTitle>
                        {SUBTITLE_LANGS.map((lang) => (
                          <MenuRow
                            key={lang.id}
                            active={subtitles === lang.id}
                            onClick={() => changeSubs(lang.id)}
                            title={lang.label}
                          />
                        ))}
                      </>
                    )}

                    {open === "episodes" && currentSeason && (
                      <>
                        <MenuTitle>{`Season ${season}`}</MenuTitle>
                        <div className="max-h-[280px] overflow-y-auto">
                          {currentSeason.episodes.map((item) => (
                            <MenuRow
                              key={item.number}
                              active={episode === item.number}
                              onClick={() => {
                                setEpisode(item.number);
                                setOpen(null);
                                setReady(false);
                              }}
                              title={`E${item.number} · ${item.name}`}
                              subtitle={`${item.runtime} min`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* thin progress rail fed by the player's telemetry */}
        {ready && duration > 0 && (
          <div className="absolute inset-x-0 top-0 z-30 h-[3px] bg-white/10">
            <div
              className="h-full bg-[#e50914] transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {/* buffering state */}
        <AnimatePresence>
          {!ready && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 grid place-items-center bg-black"
            >
              <div className="flex flex-col items-center gap-5">
                <Wordmark className="text-3xl md:text-4xl" asLink={false} />
                <div className="h-[3px] w-40 overflow-hidden rounded-full bg-white/15">
                  <motion.div
                    className="h-full w-1/3 rounded-full bg-[#e50914]"
                    animate={{ x: ["-100%", "300%"] }}
                    transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/45">
                  Loading {title.name}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BarButton({
  label,
  onClick,
  active,
  className,
}: {
  label: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition",
        active ? "border-white/60 bg-white/10 text-white" : "border-white/15 text-white/75 hover:bg-white/10 hover:text-white",
        className,
      )}
    >
      {label}
      <ChevronDownIcon width={13} height={13} />
    </button>
  );
}

function MenuTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
      {children}
    </p>
  );
}

function MenuRow({
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
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition",
        active ? "bg-white/10" : "hover:bg-white/5",
      )}
    >
      <span className="grid w-4 shrink-0 place-items-center text-[#e50914]">
        {active ? <CheckIcon width={14} height={14} /> : null}
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
