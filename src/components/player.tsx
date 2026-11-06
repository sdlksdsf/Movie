"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  NextIcon,
  SubtitlesIcon,
} from "@/components/icons";
import { useStore } from "@/components/store";
import { Wordmark } from "@/components/wordmark";
import type { Season, Title } from "@/lib/types";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */

type ServerId = "viper" | "archer";
const SERVERS: Array<{ id: ServerId; label: string; hint: string }> = [
  { id: "viper", label: "Viper", hint: "CineLite · 4K + subs" },
  { id: "archer", label: "Archer", hint: "FrameXTV · backup" },
];

const QUALITIES = ["4k", "1080p", "720p", "480p"] as const;
type Quality = (typeof QUALITIES)[number];

const SUBTITLE_LANGS = [
  { id: "off", label: "Off" },
  { id: "en", label: "English" },
  { id: "ur", label: "اردو · Urdu" },
  { id: "hi", label: "हिन्दी · Hindi" },
  { id: "ar", label: "العربية · Arabic" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
];

const ACCENT = "e50914";

function buildSrc(o: {
  server: ServerId;
  title: Title;
  season: number;
  episode: number;
  quality: Quality;
  resumeAt: number | null;
}) {
  const { server, title, season, episode, quality, resumeAt } = o;
  const params = new URLSearchParams();

  if (server === "viper") {
    const base = title.anilistId
      ? `https://embed.cinelite.xyz/anime/${title.anilistId}/${episode}`
      : title.kind === "series"
        ? `https://embed.cinelite.xyz/tv/${title.tmdbId}/${season}/${episode}`
        : `https://embed.cinelite.xyz/${title.tmdbId}`;
    params.set("color", ACCENT);
    params.set("suggestionui", "true");
    params.set("quality", quality);
    params.set("autoplay", "1");
    if (resumeAt && resumeAt > 20) params.set("t", String(Math.floor(resumeAt)));
    return `${base}?${params.toString()}`;
  }

  const base =
    title.kind === "series"
      ? `https://framextv.xyz/embed/${title.tmdbId}/${season}/${episode}`
      : `https://framextv.xyz/embed/${title.tmdbId}`;
  params.set("autoplay", "1");
  params.set("muted", "0");
  params.set("controls", "1");
  if (resumeAt && resumeAt > 20) params.set("t", String(Math.floor(resumeAt)));
  return `${base}?${params.toString()}`;
}

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

export function Player({
  title,
  initialSeason,
  initialEpisode,
  seasons,
  artwork,
}: {
  title: Title;
  initialSeason: number;
  initialEpisode: number;
  seasons: Season[];
  /** live titles have no bundled art — the page can pass a direct URL */
  artwork?: { poster?: string; backdrop?: string };
}) {
  const router = useRouter();
  const { setProgress, progress, toast } = useStore();

  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [server, setServer] = useState<ServerId>("viper");
  const [quality, setQuality] = useState<Quality>("1080p");
  const [subtitles, setSubtitles] = useState("en");
  const [menu, setMenu] = useState<null | "server" | "quality" | "subs" | "episodes">(null);
  const [chrome, setChrome] = useState(true);
  const [started, setStarted] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hideTimer = useRef<number | null>(null);
  const savedAt = useRef(0);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const qualityInitial = useRef(quality);

  /* remember preferences */
  useEffect(() => {
    const q = ls.get("nf.quality") as Quality | null;
    const s = ls.get("nf.server") as ServerId | null;
    const sub = ls.get("nf.subs");
    if (q && QUALITIES.includes(q)) {
      setQuality(q);
      qualityInitial.current = q;
    }
    const best = ls.get("nf.server.best") as ServerId | null;
    if (best && SERVERS.some((x) => x.id === best)) setServer(best);
    else if (s && SERVERS.some((x) => x.id === s)) setServer(s);
    if (sub) setSubtitles(sub);
  }, []);

  /**
   * Resume point is resolved ONCE per episode and frozen in a ref. It must never
   * depend on live progress state — that used to rebuild the iframe URL on every
   * telemetry tick, which reloaded the stream forever and always landed paused.
   */
  /* the only inputs that may reload the stream — progress is read through a ref
     so a telemetry tick can never remount the iframe */
  const src = useMemo(() => {
    const stored = progressRef.current[title.slug];
    const sameEpisode = stored && stored.season === season && stored.episode === episode;
    const resumeAt =
      sameEpisode && stored.percent > 0.02 && stored.percent < 0.95 && stored.seconds
        ? stored.seconds
        : null;
    return buildSrc({
      server,
      title,
      season,
      episode,
      quality: qualityInitial.current,
      resumeAt,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, title.tmdbId, title.kind, title.anilistId, season, episode]);

  const currentSeason = seasons.find((s) => s.number === season);
  const episodeMeta = currentSeason?.episodes.find((e) => e.number === episode);
  const hasNext = title.kind === "series" && Boolean(currentSeason && episode < currentSeason.episodes.length);

  /* ---- server selection: start with the last known-good one, fall back fast ---- */
  const triedFallback = useRef(false);
  const loadedRef = useRef(false);

  const markServerGood = useCallback(
    (id: ServerId) => {
      if (ls.get("nf.server.best") !== id) ls.set("nf.server.best", id);
    },
    [],
  );

  const fallbackServer = useCallback(() => {
    if (triedFallback.current) return;
    triedFallback.current = true;
    const other: ServerId = server === "viper" ? "archer" : "viper";
    setServer(other);
    ls.set("nf.server", other);
    toast(`No signal — switched to ${other === "viper" ? "Viper" : "Archer"}`);
  }, [server, toast]);

  /* ---- chrome auto hide ---- */
  const poke = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChrome(false), 3600);
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

  /* ---- talk to the embed ---- */
  const post = useCallback((payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(payload, "*");
  }, []);

  useEffect(() => {
    post({
      type: "CINELITE_SYNC_SETTINGS",
      preferredQuality: quality,
      subtitles: subtitles !== "off",
      subtitleLanguage: subtitles === "off" ? null : subtitles,
    });
  }, [post, quality, subtitles]);

  useEffect(() => {
    const token = ls.get("nf.febbox");
    if (!token) return;
    post({ type: "CINELITE_SYNC_FEBBOX_TOKEN", token });
    const id = window.setTimeout(() => post({ type: "CINELITE_SYNC_FEBBOX_TOKEN", token }), 2500);
    return () => window.clearTimeout(id);
  }, [post, src]);

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
  }, [router, setProgress, title.slug, season, episode]);

  /**
   * The overlay is only a "finding a source" hint — it must vanish as soon as
   * the frame loads (onLoad clears it below) and it must never sit on top of a
   * playing stream. If the server stays silent we switch automatically.
   */
  useEffect(() => {
    setStarted(false);
    loadedRef.current = false;
    const quick = window.setTimeout(() => setStarted(true), 1800);
    /* only recover when the frame never even loaded — never interrupt a live stream */
    const silent = window.setTimeout(() => {
      if (!loadedRef.current) fallbackServer();
    }, 7000);
    return () => {
      window.clearTimeout(quick);
      window.clearTimeout(silent);
    };
  }, [src, fallbackServer]);

  /* keyboard: only the things the embed cannot do itself */
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

  const changeQuality = (next: Quality) => {
    setQuality(next);
    qualityInitial.current = next;
    setMenu(null);
    ls.set("nf.quality", next);
    toast(`Quality · ${next.toUpperCase()}`);
  };

  const changeServer = (next: ServerId) => {
    setServer(next);
    setMenu(null);
    triedFallback.current = false;
    ls.set("nf.server", next);
    ls.set("nf.server.best", next);
    toast(`Server · ${SERVERS.find((s) => s.id === next)?.label}`);
  };

  const changeSubs = (next: string) => {
    setSubtitles(next);
    setMenu(null);
    ls.set("nf.subs", next);
    toast(next === "off" ? "Subtitles off" : `Subtitles · ${SUBTITLE_LANGS.find((l) => l.id === next)?.label}`);
  };

  const jumpTo = (nextEpisode: number) => {
    setEpisode(nextEpisode);
    setMenu(null);
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-black text-white">
      <iframe
        ref={iframeRef}
        src={src}
        title={`${title.name} · NOFLIX`}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture; presentation"
        allowFullScreen
        referrerPolicy="origin"
        onLoad={() => {
          loadedRef.current = true;
          markServerGood(server);
          window.setTimeout(() => setStarted(true), 400);
        }}
        className="absolute inset-0 h-full w-full border-0"
      />

      {/* overlay is click-through except for the bar */}
      <div className="pointer-events-none absolute inset-0">
        {/* slim "finding a source" hint — never covers the stream */}
        <AnimatePresence>
          {!started && (
            <motion.div
              key="hint"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="absolute left-1/2 top-3 z-30 -translate-x-1/2"
            >
              <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-black/70 px-3.5 py-1.5 backdrop-blur-md">
                <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/25 border-t-[#e50914]" />
                <span className="text-[11px] font-medium tracking-wide text-white/75">
                  Finding a source… ({SERVERS.find((s) => s.id === server)?.label})
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* top bar */}
        <AnimatePresence>
          {chrome && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/90 via-black/55 to-transparent px-3 pb-12 pt-3 md:px-6"
            >
              <div className="flex items-center gap-2 md:gap-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  aria-label="Back"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeftIcon width={21} height={21} />
                </button>

                <Wordmark className="hidden text-xl sm:block" asLink={false} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold md:text-[15px]">{title.name}</p>
                  <p className="truncate text-[11px] text-white/55">
                    {title.kind === "series" ? `S${season} · E${episode}` : `${title.year} · ${title.maturity}`}
                    {title.anilistId ? " · Anime" : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {hasNext && (
                    <button
                      type="button"
                      onClick={() => setEpisode((e) => e + 1)}
                      aria-label="Next episode"
                      className="grid h-9 w-9 place-items-center rounded-md border border-white/20 text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                      <NextIcon width={16} height={16} />
                    </button>
                  )}
                  <Chip
                    active={menu === "server"}
                    onClick={() => setMenu(menu === "server" ? null : "server")}
                    label={SERVERS.find((s) => s.id === server)?.label ?? "Server"}
                  />
                  <Chip
                    active={menu === "quality"}
                    onClick={() => setMenu(menu === "quality" ? null : "quality")}
                    label={quality.toUpperCase()}
                  />
                  <button
                    type="button"
                    onClick={() => setMenu(menu === "subs" ? null : "subs")}
                    aria-label="Subtitles"
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-md border transition",
                      subtitles === "off"
                        ? "border-white/15 text-white/45 hover:text-white"
                        : "border-white/35 text-white hover:bg-white/10",
                    )}
                  >
                    <SubtitlesIcon width={16} height={16} />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {menu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-3 top-[58px] w-[250px] overflow-hidden rounded-lg border border-white/10 bg-[#141414]/97 p-1.5 shadow-2xl backdrop-blur-xl md:right-6"
                  >
                    {menu === "server" && (
                      <>
                        <MenuLabel>Server</MenuLabel>
                        {SERVERS.map((s) => (
                          <Row
                            key={s.id}
                            active={server === s.id}
                            title={s.label}
                            subtitle={s.hint}
                            onClick={() => changeServer(s.id)}
                          />
                        ))}
                        <Row
                          title="FebBox token"
                          subtitle="Unlock 4K cloud sources"
                          onClick={() => {
                            const token = window.prompt("Paste your FebBox UI cookie token");
                            if (!token) return;
                            ls.set("nf.febbox", token.trim());
                            post({ type: "CINELITE_SYNC_FEBBOX_TOKEN", token: token.trim() });
                            toast("FebBox token saved");
                            setMenu(null);
                          }}
                        />
                      </>
                    )}

                    {menu === "quality" && (
                      <>
                        <MenuLabel>Quality</MenuLabel>
                        {QUALITIES.map((q) => (
                          <Row key={q} active={quality === q} title={q.toUpperCase()} onClick={() => changeQuality(q)} />
                        ))}
                      </>
                    )}

                    {menu === "subs" && (
                      <>
                        <MenuLabel>Subtitles</MenuLabel>
                        {SUBTITLE_LANGS.map((l) => (
                          <Row key={l.id} active={subtitles === l.id} title={l.label} onClick={() => changeSubs(l.id)} />
                        ))}
                      </>
                    )}

                    {menu === "episodes" && currentSeason && (
                      <>
                        <MenuLabel>Season {season}</MenuLabel>
                        <div className="max-h-[260px] overflow-y-auto">
                          {currentSeason.episodes.map((item) => (
                            <Row
                              key={item.number}
                              active={episode === item.number}
                              title={`E${item.number} · ${item.name}`}
                              subtitle={`${item.runtime} min`}
                              onClick={() => jumpTo(item.number)}
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

        {/* bottom-right episode picker (kept out of the top bar to stay clean) */}
        {title.kind === "series" && seasons.length > 0 && (
          <button
            type="button"
            onClick={() => setMenu(menu === "episodes" ? null : "episodes")}
            className={cn(
              "pointer-events-auto absolute bottom-5 right-4 z-20 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium backdrop-blur transition md:bottom-6 md:right-6",
              menu === "episodes"
                ? "border-white/60 bg-white/15 text-white"
                : "border-white/20 bg-black/45 text-white/75 hover:text-white",
            )}
          >
            Episodes <ChevronDownIcon width={12} height={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-md border px-2.5 text-[11px] font-semibold uppercase tracking-wide transition",
        active
          ? "border-white/60 bg-white/15 text-white"
          : "border-white/20 text-white/75 hover:bg-white/10 hover:text-white",
      )}
    >
      {label}
      <ChevronDownIcon width={11} height={11} />
    </button>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
      {children}
    </p>
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
        <span className={cn("block truncate text-[13px]", active ? "text-white" : "text-white/80")}>{title}</span>
        {subtitle && <span className="block truncate text-[11px] text-white/40">{subtitle}</span>}
      </span>
    </button>
  );
}
