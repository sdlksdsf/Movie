"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  FullscreenIcon,
  MuteIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  SubtitlesIcon,
  VolumeIcon,
} from "@/components/icons";
import { useStore } from "@/components/store";
import type { Season, Title } from "@/lib/types";
import { cn } from "@/lib/cn";

const PROVIDERS = [
  { id: "auto", label: "Auto" },
  { id: "barbarian", label: "Barbarian" },
  { id: "archer", label: "Archer" },
  { id: "goblin", label: "Goblin" },
];

function buildUrl(tmdbId: number, season?: number, episode?: number, provider = "auto") {
  const base =
    season && episode
      ? `https://framextv.xyz/embed/${tmdbId}/${season}/${episode}`
      : `https://framextv.xyz/embed/${tmdbId}`;
  const params = new URLSearchParams({ autoplay: "1", muted: "0", controls: "1" });
  if (provider !== "auto") params.set("server", provider);
  return `${base}?${params.toString()}`;
}

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
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
}) {
  const router = useRouter();
  const { setProgress, toast } = useStore();
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [provider, setProvider] = useState("auto");
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [chrome, setChrome] = useState(true);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [settings, setSettings] = useState<null | "provider" | "episodes">(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const lastSaved = useRef(0);
  const readyTimer = useRef<number | null>(null);

  const src = useMemo(
    () =>
      title.kind === "series"
        ? buildUrl(title.tmdbId, season, episode, provider)
        : buildUrl(title.tmdbId, undefined, undefined, provider),
    [title.kind, title.tmdbId, season, episode, provider],
  );

  const currentSeason = seasons.find((s) => s.number === season);
  const episodeMeta = currentSeason?.episodes.find((e) => e.number === episode);
  const hasNext =
    title.kind === "series" &&
    Boolean(currentSeason && episode < (currentSeason.episodes.length ?? 0));

  /** postMessage bridge to the frameXTV player SDK. */
  const send = useCallback((action: string, payload: Record<string, unknown> = {}) => {
    iframeRef.current?.contentWindow?.postMessage({ action, ...payload }, "*");
  }, []);

  const goNext = useCallback(() => {
    if (!hasNext) return;
    setEpisode((e) => e + 1);
    setState("loading");
    setPaused(false);
    setTime(0);
  }, [hasNext]);

  /** chrome auto-hide */
  const poke = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!settings) setChrome(false);
    }, 3200);
  }, [settings]);

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

  /** telemetry from the embed */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.event === "frameXTV:timeupdate") {
        const current = Number(data.currentTime) || 0;
        const total = Number(data.duration) || 0;
        setTime(current);
        if (total) setDuration(total);
        setState("ready");
        const pct = total ? current / total : 0;
        const now = Date.now();
        if (now - lastSaved.current > 4000) {
          lastSaved.current = now;
          setProgress(title.slug, { season, episode, percent: pct, updated: now });
        }
      }
      if (data.event === "frameXTV:play") setPaused(false);
      if (data.event === "frameXTV:pause") setPaused(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [title.slug, season, episode, setProgress]);

  /** keyboard shortcuts */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      switch (event.key) {
        case " ":
          event.preventDefault();
          send(paused ? "play" : "pause");
          setPaused((p) => !p);
          poke();
          break;
        case "ArrowRight":
          send("seekBy", { seconds: 10 });
          poke();
          break;
        case "ArrowLeft":
          send("seekBy", { seconds: -10 });
          poke();
          break;
        case "m":
          setMuted((m) => {
            send(m ? "setVolume" : "mute", m ? { volume: 1 } : {});
            return !m;
          });
          break;
        case "f":
          toggleFullscreen();
          break;
        case "n":
          goNext();
          break;
        case "Escape":
          if (settings) setSettings(null);
          else router.push("/");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, send, poke, goNext, settings, router]);

  const toggleFullscreen = () => {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  };

  /** fallback: if the embed never reports anything, stop spinning */
  useEffect(() => {
    setState("loading");
    readyTimer.current = window.setTimeout(() => setState((s) => (s === "loading" ? "ready" : s)), 9000);
    return () => {
      if (readyTimer.current) window.clearTimeout(readyTimer.current);
    };
  }, [src]);

  const total = duration || (title.kind === "movie" ? (title.runtime ?? 110) * 60 : (episodeMeta?.runtime ?? 48) * 60);
  const pct = total ? Math.min(100, (time / total) * 100) : 0;
  const nearEnd = total > 0 && time > 0 && total - time < 90;
  const episodeLabel =
    title.kind === "series"
      ? `S${season}:E${episode} ${episodeMeta ? `· ${episodeMeta.name}` : ""}`
      : `${title.year} · ${title.maturity}`;

  return (
    <div ref={shellRef} className="relative h-[100svh] w-full overflow-hidden bg-black">
      <iframe
        key={src}
        ref={iframeRef}
        src={src}
        title={`${title.name} — player`}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        onLoad={() => window.setTimeout(() => setState("ready"), 1200)}
        className="absolute inset-0 h-full w-full border-0"
      />

      {/* loading overlay */}
      <AnimatePresence>
        {state === "loading" && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="pointer-events-none absolute inset-0 grid place-items-center bg-black"
          >
            <div className="flex flex-col items-center gap-4">
              <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-netflix-red" />
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Preparing stream</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* chrome */}
      <AnimatePresence>
        {chrome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.72), transparent 22%, transparent 66%, rgba(0,0,0,0.86))" }}
          >
            {/* top bar */}
            <div className="pointer-events-auto flex items-center gap-3 px-4 py-4 md:px-8">
              <button
                type="button"
                onClick={() => router.push("/")}
                aria-label="Back to browsing"
                className="focus-brand grid h-10 w-10 place-items-center rounded-full text-white transition hover:bg-white/10"
              >
                <ArrowLeftIcon width={24} height={24} />
              </button>
              <div className="min-w-0">
                <p className="truncate font-display text-lg leading-tight tracking-wide text-white md:text-2xl">
                  {title.name}
                </p>
                <p className="truncate text-[11.5px] text-white/60">{episodeLabel}</p>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {title.kind === "series" && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSettings(settings === "episodes" ? null : "episodes")}
                      className="flex items-center gap-1.5 rounded border border-white/25 bg-black/40 px-3 py-1.5 text-xs text-white transition hover:border-white/60"
                    >
                      Season {season}
                      <ChevronDownIcon width={13} height={13} />
                    </button>
                    <AnimatePresence>
                      {settings === "episodes" && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="absolute right-0 top-10 z-30 max-h-[60vh] w-[280px] overflow-y-auto rounded-md border border-white/15 bg-[#141414]/97 p-2 shadow-2xl backdrop-blur"
                        >
                          <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                            Seasons
                          </p>
                          <div className="mb-2 flex flex-wrap gap-1.5 px-1">
                            {seasons.map((s) => (
                              <button
                                key={s.number}
                                type="button"
                                onClick={() => {
                                  setSeason(s.number);
                                  setEpisode(1);
                                  setState("loading");
                                }}
                                className={cn(
                                  "rounded px-2.5 py-1 text-xs transition",
                                  s.number === season
                                    ? "bg-white text-black"
                                    : "bg-white/10 text-white/80 hover:bg-white/20",
                                )}
                              >
                                S{s.number}
                              </button>
                            ))}
                          </div>
                          <p className="px-2 pb-1 text-[10px] uppercase tracking-[0.2em] text-white/40">
                            Episodes
                          </p>
                          {currentSeason?.episodes.map((ep) => (
                            <button
                              key={ep.number}
                              type="button"
                              onClick={() => {
                                setEpisode(ep.number);
                                setState("loading");
                                setSettings(null);
                              }}
                              className={cn(
                                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition",
                                ep.number === episode
                                  ? "bg-white/15 text-white"
                                  : "text-white/70 hover:bg-white/10",
                              )}
                            >
                              <span className="w-4 text-white/40">{ep.number}</span>
                              <span className="flex-1 truncate">{ep.name}</span>
                              <span className="text-white/30">{ep.runtime}m</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSettings(settings === "provider" ? null : "provider")}
                    className="hidden items-center gap-1.5 rounded border border-white/25 bg-black/40 px-3 py-1.5 text-xs text-white transition hover:border-white/60 sm:flex"
                  >
                    Server: {PROVIDERS.find((p) => p.id === provider)?.label}
                    <ChevronDownIcon width={13} height={13} />
                  </button>
                  <AnimatePresence>
                    {settings === "provider" && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="absolute right-0 top-10 z-30 w-[180px] overflow-hidden rounded-md border border-white/15 bg-[#141414]/97 py-1 shadow-2xl backdrop-blur"
                      >
                        {PROVIDERS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setProvider(p.id);
                              setSettings(null);
                              setState("loading");
                              send("setProvider", { provider: p.id });
                              toast(`Switching to ${p.label} server…`);
                            }}
                            className={cn(
                              "block w-full px-3 py-2 text-left text-xs transition hover:bg-white/10",
                              p.id === provider ? "text-white" : "text-white/70",
                            )}
                          >
                            {p.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  aria-label="Subtitles"
                  onClick={() => {
                    send("setSubtitle", { index: 0 });
                    toast("Subtitles toggled inside the player");
                  }}
                  className="hidden h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/10 sm:grid"
                >
                  <SubtitlesIcon width={19} height={19} />
                </button>
                <button
                  type="button"
                  aria-label={muted ? "Unmute" : "Mute"}
                  onClick={() => {
                    send(muted ? "setVolume" : "mute", muted ? { volume: 1 } : {});
                    setMuted((m) => !m);
                  }}
                  className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/10"
                >
                  {muted ? <MuteIcon width={19} height={19} /> : <VolumeIcon width={19} height={19} />}
                </button>
                <button
                  type="button"
                  aria-label="Fullscreen"
                  onClick={toggleFullscreen}
                  className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/10"
                >
                  <FullscreenIcon width={19} height={19} />
                </button>
              </div>
            </div>

            {/* bottom bar */}
            <div className="pointer-events-auto px-4 pb-5 md:px-8">
              <AnimatePresence>
                {nearEnd && hasNext && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 flex justify-end"
                  >
                    <button
                      type="button"
                      onClick={goNext}
                      className="flex items-center gap-2 rounded bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/85"
                    >
                      Next episode
                      <NextIcon width={15} height={15} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={paused ? "Play" : "Pause"}
                  onClick={() => {
                    send(paused ? "play" : "pause");
                    setPaused((p) => !p);
                  }}
                  className="grid h-10 w-10 place-items-center rounded-full text-white transition hover:bg-white/10"
                >
                  {paused ? <PlayIcon width={22} height={22} /> : <PauseIcon width={20} height={20} />}
                </button>

                <button
                  type="button"
                  aria-label={hasNext ? "Next episode" : "Next"}
                  onClick={goNext}
                  disabled={!hasNext}
                  className="grid h-10 w-10 place-items-center rounded-full text-white transition hover:bg-white/10 disabled:opacity-30"
                >
                  <NextIcon width={20} height={20} />
                </button>

                <div className="flex flex-1 items-center gap-3">
                  <span className="hidden text-[11px] tabular-nums text-white/70 sm:block">
                    {clock(time)}
                  </span>
                  <div
                    className="group relative h-[4px] flex-1 cursor-pointer rounded-full bg-white/25"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      const ratio = (event.clientX - rect.left) / rect.width;
                      send("seek", { time: Math.round(ratio * total) });
                      setTime(ratio * total);
                    }}
                    role="slider"
                    aria-label="Seek"
                    aria-valuemin={0}
                    aria-valuemax={Math.round(total)}
                    aria-valuenow={Math.round(time)}
                    tabIndex={0}
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-netflix-red transition-[width] duration-200"
                      style={{ width: `${pct}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-netflix-red opacity-0 transition group-hover:opacity-100"
                      style={{ left: `calc(${pct}% - 6px)` }}
                    />
                  </div>
                  <span className="hidden text-[11px] tabular-nums text-white/50 sm:block">
                    {clock(total)}
                  </span>
                </div>

                {title.kind === "series" && (
                  <span className="hidden text-[11px] uppercase tracking-[0.18em] text-white/45 md:block">
                    {episodeLabel}
                  </span>
                )}
              </div>

              <p className="mt-3 hidden text-[10.5px] text-white/30 md:block">
                Space play/pause · ← → seek · M mute · F fullscreen · N next episode · Esc exit
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* stream fallback helper */}
      {state === "ready" && (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-2 right-3 z-30 rounded bg-black/50 px-2 py-1 text-[10px] text-white/40 transition hover:text-white"
        >
          Stream not starting? Open embed ↗
        </a>
      )}
    </div>
  );
}
