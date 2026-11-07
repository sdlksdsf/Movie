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
  SubtitlesIcon,
} from "@/components/icons";
import { useStore } from "@/components/store";
import { Wordmark } from "@/components/wordmark";
import { Artwork } from "@/components/artwork";
import { shortMeta } from "@/lib/catalog";
import { moreLikeThis } from "@/lib/taste";
import {
  DEFAULT_PLAYER,
  DEFAULT_QUALITY,
  PLAYERS,
  QUALITIES,
  buildSrc,
  canPlay,
  isPlayerId,
  otherPlayer,
  playerMeta,
  resolvePlayer,
  playOrder,
  isAnimeTitle,
  playerMeta as metaOf,
  type AudioTrack,
  type PlayerId,
  type Quality,
} from "@/lib/players";
import { anilistIdFor } from "@/lib/anime-ids";
import type { Season, Title } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * One player, one layer.
 *
 * Playback itself belongs to the third-party embed in the iframe — play/pause,
 * seek, volume, subtitles, audio and fullscreen live in *its* bottom bar. We
 * never draw a second control strip over it.
 *
 * Our chrome only covers what the embed can't do:
 *   source switching (frameXTV default, CineLite backup) · next episode /
 *   auto-advance · seasons · back · resume position · pause suggestions.
 */

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

type Tick = {
  current: number;
  total: number;
  completed: boolean;
  season?: number | null;
  episode?: number | null;
};

/** Accept any provider's tick shape — both embeds post different envelopes. */
function readTick(data: unknown): Tick | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;

  const payload = (raw.payload as Record<string, unknown> | undefined) ?? raw;

  const current = Number(payload.currentTime ?? payload.current ?? payload.time);
  const total = Number(payload.duration);
  if (!Number.isFinite(current)) return null;
  if (!Number.isFinite(total) || total <= 0) {
    if (!Number.isFinite(current) || current <= 0) return null;
  }

  const pct = Number(payload.progress);
  const completed =
    Boolean(payload.completed) ||
    (Number.isFinite(pct) && pct >= 99.4) ||
    (total > 0 && current / total >= 0.995);

  return {
    current,
    total: Number.isFinite(total) ? total : 0,
    completed,
    season: (payload.season as number | null | undefined) ?? null,
    episode: (payload.episode as number | null | undefined) ?? null,
  };
}

function nextEpisodeOf(seasons: Season[], season: number, episode: number) {
  const current = seasons.find((s) => s.number === season);
  if (current && episode < current.episodes.length) return { season, episode: episode + 1 };
  const after = seasons.find((s) => s.number === season + 1);
  if (after && after.episodes.length > 0) return { season: season + 1, episode: 1 };
  return null;
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
  const { setProgress, progress, toast, settings, updateSettings } = useStore();
  const audio: AudioTrack = settings.animeAudio ?? "sub";

  const [mounted, setMounted] = useState(false);
  const anime = isAnimeTitle(title);
  const [anilistId, setAnilistId] = useState<number | null>(title.anilistId ?? null);
  /* anime servers need an AniList id — hold the frame until we have one */
  const [aniState, setAniState] = useState<"pending" | "ok" | "none">(() =>
    anime && !title.anilistId ? "pending" : "ok",
  );
  const [player, setPlayer] = useState<PlayerId>(() =>
    resolvePlayer(anime ? "vidnest" : DEFAULT_PLAYER, title),
  );
  const [quality, setQuality] = useState<Quality>(DEFAULT_QUALITY);
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);

  const [menu, setMenu] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [upNext, setUpNext] = useState<{ left: number } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hideTimer = useRef<number | null>(null);
  const savedAt = useRef(0);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const loadedRef = useRef(false);
  const playingRef = useRef(false);
  const lastTime = useRef(0);
  const stillHits = useRef(0);
  const pauseTimer = useRef<number | null>(null);
  const nudgeTimer = useRef<number | null>(null);
  const nudgeHide = useRef<number | null>(null);
  const tried = useRef<Set<PlayerId>>(new Set());
  const fallbackUsed = useRef(false);
  const dismissed = useRef(false);

  const clearPauseTimer = () => {
    if (pauseTimer.current) window.clearTimeout(pauseTimer.current);
    pauseTimer.current = null;
  };

  /* anime servers speak AniList ids — resolve one when the title lacks it */
  useEffect(() => {
    if (!anime) {
      setAniState("ok");
      return;
    }
    if (title.anilistId) {
      setAnilistId(title.anilistId);
      setAniState("ok");
      return;
    }
    let alive = true;
    setAniState("pending");
    void anilistIdFor({
      name: title.name,
      year: title.year,
      tmdbId: title.tmdbId,
      malId: title.malId,
    }).then((id) => {
      if (!alive) return;
      setAnilistId(id);
      setAniState(id ? "ok" : "none");
    });
    return () => {
      alive = false;
    };
  }, [anime, title.slug, title.name, title.year, title.tmdbId, title.anilistId, title.malId]);

  /* no AniList match at all: fall back to the TMDB servers rather than a blank frame */
  useEffect(() => {
    if (aniState !== "none") return;
    setPlayer((current) =>
      canPlay(current, title, null) && current !== "aniembed"
        ? current
        : resolvePlayer(DEFAULT_PLAYER, title, null),
    );
  }, [aniState, title]);

  /* restore the user's chosen source + quality (default: frameXTV) */
  useEffect(() => {
    setMounted(true);
    const stored = ls.get("nf.player");
    const preferred = isPlayerId(stored) ? stored : DEFAULT_PLAYER;
    /* anime never starts on a TMDB-only server; films/series keep the user's pick */
    const start = anime && !metaOf(preferred).animeOnly ? "vidnest" : preferred;
    setPlayer(resolvePlayer(start, title, title.anilistId ?? null));
    const q = ls.get("nf.quality");
    if (q && (QUALITIES as readonly string[]).includes(q)) setQuality(q as Quality);
    // legacy keys are deliberately ignored so everyone lands on frameXTV
  }, [title]);

  /**
   * The embed URL depends only on [source, quality, episode] — playback
   * telemetry is read through refs, so a tick can never remount the frame
   * (that was the old endless-reconnect bug).
   */
  const src = useMemo(() => {
    const stored = progressRef.current[title.slug];
    const sameEpisode = stored && stored.season === season && stored.episode === episode;
    const resumeAt =
      sameEpisode && stored.percent > 0.02 && stored.percent < 0.95 && stored.seconds
        ? stored.seconds
        : null;
    return buildSrc({
      player,
      title,
      season,
      episode,
      quality,
      resumeAt,
      anilistId,
      audio,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    player,
    quality,
    title.tmdbId,
    title.anilistId,
    title.kind,
    season,
    episode,
    nonce,
    anilistId,
    audio,
  ]);

  const suggestions = useMemo(() => moreLikeThis(title, progress, 6), [title, progress]);

  /* servers in this title's own failover order */
  const orderedPlayers = useMemo(
    () => playOrder(title).map((id) => PLAYERS.find((entry) => entry.id === id)).filter(Boolean) as typeof PLAYERS,
    [title],
  );
  const nextEp = useMemo(() => nextEpisodeOf(seasons, season, episode), [seasons, season, episode]);
  const currentSeason = seasons.find((s) => s.number === season);

  /* ---------------------------------------------------------------- source */

  /** Walk the server chain: frameXTV → CineLite → RiveStream, each at most once. */
  const hardFallback = useCallback(() => {
    const candidate = playOrder(title).find(
      (id) => id !== player && canPlay(id, title, anilistId) && !tried.current.has(id),
    );
    if (!candidate) return;
    tried.current.add(player);
    fallbackUsed.current = true;
    setPlayer(candidate);
    toast(`${playerMeta(player).label} didn't respond — trying ${playerMeta(candidate).label}`);
  }, [player, title, toast, anilistId]);

  /* per-source reset: cheap, so switching feels instant */
  useEffect(() => {
    setLoaded(false);
    setPlaying(false);
    setPaused(false);
    setNudge(false);
    setUpNext(null);
    dismissed.current = false;
    loadedRef.current = false;
    playingRef.current = false;
    lastTime.current = 0;
    stillHits.current = 0;
    clearPauseTimer();

    const slow = window.setTimeout(() => {
      if (!loadedRef.current) hardFallback();
    }, 9000);
    return () => window.clearTimeout(slow);
  }, [src, hardFallback]);

  /* if the frame loads but nothing ever starts, offer a one-tap start …
     and if that source still refuses to play, hop to the backup by itself */
  useEffect(() => {
    if (!loaded) return;
    if (nudgeTimer.current) window.clearTimeout(nudgeTimer.current);
    if (nudgeHide.current) window.clearTimeout(nudgeHide.current);

    nudgeTimer.current = window.setTimeout(() => {
      if (playingRef.current) return;
      setNudge(true);
      nudgeHide.current = window.setTimeout(() => setNudge(false), 20000);
    }, 3200);

    const hop = window.setTimeout(() => {
      if (!playingRef.current) hardFallback();
    }, 10000);

    return () => {
      if (nudgeTimer.current) window.clearTimeout(nudgeTimer.current);
      if (nudgeHide.current) window.clearTimeout(nudgeHide.current);
      window.clearTimeout(hop);
    };
  }, [loaded, src, hardFallback]);

  /* ------------------------------------------------------------- telemetry */

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if ((data as { type?: string }).type === "CINELITE_EXIT_PLAYER") {
        router.back();
        return;
      }

      const tick = readTick(data);
      if (!tick) return;

      const { current, total } = tick;

      if (!loadedRef.current) {
        loadedRef.current = true;
        setLoaded(true);
      }
      if (!playingRef.current && current > 0.5) {
        playingRef.current = true;
        setPlaying(true);
        setNudge(false);
      }

      /* pause = a tick whose clock didn't move (providers tick ~3.5s) */
      const delta = current - lastTime.current;
      lastTime.current = current;
      if (delta > 0.4) {
        stillHits.current = 0;
        clearPauseTimer();
        setPaused(false);
      } else if (current > 5) {
        clearPauseTimer();
        pauseTimer.current = window.setTimeout(() => {
          stillHits.current += 1;
          setPaused(true);
          setShowSuggestions(true);
        }, 1200);
      }

      /* up-next: fires once, near the end of an episode */
      const ratio = total > 0 ? current / total : 0;
      if (tick.completed || ratio >= 0.93) {
        if (!dismissed.current && nextEp) {
          setUpNext((prev) => prev ?? { left: 12 });
        }
      }

      const now = Date.now();
      if (now - savedAt.current > 5000 || tick.completed) {
        savedAt.current = now;
        setProgress(title.slug, {
          season: title.kind === "series" ? (tick.season ?? season) : 1,
          episode: title.kind === "series" ? (tick.episode ?? episode) : 1,
          percent: tick.completed ? 1 : Math.min(1, Math.max(0, ratio)),
          seconds: current,
          duration: total,
          updated: now,
        });
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router, setProgress, title.slug, title.kind, season, episode, nextEp]);

  /* ----------------------------------------------------------- up next flow */

  const goTo = useCallback(
    (s: number, e: number) => {
      setUpNext(null);
      dismissed.current = false;
      setSeason(s);
      setEpisode(e);
      setMenu(false);
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `/watch/series/${title.slug}?s=${s}&e=${e}`);
      }
    },
    [title.slug],
  );

  useEffect(() => {
    if (!upNext) return;
    if (upNext.left <= 0) {
      if (nextEp) goTo(nextEp.season, nextEp.episode);
      return;
    }
    const timer = window.setTimeout(
      () => setUpNext((current) => (current ? { left: current.left - 1 } : current)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [upNext, nextEp, goTo]);

  /* ---------------------------------------------------------------- chrome */

  const poke = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChrome(false), 3000);
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (event.key === "Escape") {
        if (menu) setMenu(false);
        else router.back();
        return;
      }
      if (event.key.toLowerCase() === "n" && nextEp) goTo(nextEp.season, nextEp.episode);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, router, nextEp, goTo]);

  /* --------------------------------------------------------------- actions */

  const canPlayNow = (id: PlayerId) => resolvePlayer(id, title) === id;

  const changePlayer = (next: PlayerId) => {
    if (!canPlayNow(next)) {
      toast(`${playerMeta(next).label} has no stream for this title`);
      return;
    }
    tried.current.clear();
    setPlayer(next);
    ls.set("nf.player", next);
    toast(`Playing from ${playerMeta(next).label}`);
    setMenu(false);
  };

  const changeQuality = (next: Quality) => {
    setQuality(next);
    ls.set("nf.quality", next);
    toast(`Restarting in ${next.toUpperCase()}`);
    setMenu(false);
  };

  const restart = () => {
    setNudge(false);
    setNonce((n) => n + 1);
  };

  const showChrome = chrome || menu || Boolean(upNext);
  const showRail = paused && playing && !upNext && showSuggestions && suggestions.length > 0;
  const activePlayer = playerMeta(player);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      {/* warm the connection to whichever embed is next */}
      <link rel="preconnect" href="https://framextv.cc" crossOrigin="" />
      <link rel="dns-prefetch" href="https://framextv.cc" />
      <link rel="preconnect" href="https://embed.cinelite.xyz" crossOrigin="" />
      <link rel="dns-prefetch" href="https://embed.cinelite.xyz" />

      {/* poster behind the frame: never a black flash while it boots */}
      <div className="absolute inset-0">
        <Artwork
          slug={title.slug}
          name={title.name}
          kind="backdrop"
          accent={title.accent}
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/80" />
      </div>

      {mounted && aniState !== "pending" && (
        <iframe
          ref={iframeRef}
          key={src}
          src={src}
          title={`${title.name} · NOFLIX`}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; presentation"
          allowFullScreen
          referrerPolicy="origin"
          loading="eager"
          onLoad={() => {
            loadedRef.current = true;
            setLoaded(true);
          }}
          onError={() => hardFallback()}
          className="absolute inset-0 z-10 h-full w-full border-0"
        />
      )}

      {/* thin load bar, top edge — instant, non-blocking feedback */}
      <AnimatePresence>
        {!loaded && mounted && aniState !== "pending" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 top-0 z-40 h-[2px] overflow-hidden bg-white/10"
          >
            <motion.div
              initial={{ x: "-40%" }}
              animate={{ x: "140%" }}
              transition={{ repeat: Infinity, duration: 1.05, ease: "linear" }}
              className="h-full w-1/3 bg-[var(--nf-accent)]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* everything below is click-through; only real buttons take input */}
      <div className="pointer-events-none absolute inset-0 z-30">
        {/* top-left: back + what's playing */}
        <AnimatePresence>
          {showChrome && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.16 }}
              className="absolute left-3 top-3 flex items-center gap-2 md:left-5 md:top-4"
            >
              <button
                type="button"
                onClick={() => router.back()}
                aria-label="Back"
                className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white/90 backdrop-blur-md transition hover:bg-black/80 hover:text-white"
              >
                <ArrowLeftIcon width={20} height={20} />
              </button>

              <div className="max-w-[42vw] rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-md">
                <p className="truncate text-[12.5px] font-semibold leading-tight text-white">
                  {title.name}
                </p>
                <p className="truncate text-[10.5px] leading-tight text-white/55">
                  {title.kind === "series"
                    ? `S${season} · E${episode}${nextEp ? " · Up next ready" : ""}`
                    : `${title.year} · ${title.maturity}`}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* top-right: next episode + source picker */}
        <AnimatePresence>
          {showChrome && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.16 }}
              className="absolute right-3 top-3 z-30 flex items-center gap-2 md:right-5 md:top-4"
            >
              {nextEp && (
                <button
                  type="button"
                  onClick={() => goTo(nextEp.season, nextEp.episode)}
                  className="pointer-events-auto flex h-10 items-center gap-1.5 rounded-full bg-black/60 px-3 text-[12px] font-semibold text-white/90 backdrop-blur-md transition hover:bg-black/80 hover:text-white"
                  aria-label="Next episode"
                >
                  <NextIcon width={16} height={16} />
                  <span className="hidden sm:inline">Next</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setMenu((open) => !open)}
                aria-label="Player options"
                className={cn(
                  "pointer-events-auto flex h-10 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold backdrop-blur-md transition",
                  menu
                    ? "bg-white text-black"
                    : "bg-black/60 text-white/85 hover:bg-black/80 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    loaded ? "bg-[#46d369]" : "bg-amber-400",
                  )}
                />
                {activePlayer.label}
                <ChevronDownIcon width={13} height={13} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* options panel */}
        <AnimatePresence>
          {menu && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              className="pointer-events-auto absolute right-3 top-16 z-40 max-h-[76vh] w-[286px] overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#141414]/[0.98] p-1.5 shadow-2xl backdrop-blur-xl md:right-5"
            >
              <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Player
              </p>
              {orderedPlayers.map((item) => {
                const available = canPlayNow(item.id);
                return (
                  <Row
                    key={item.id}
                    active={player === item.id}
                    title={
                      <span className="flex items-center gap-1.5">
                        {item.label}
                        {item.badge && (
                          <span className="rounded-sm bg-[var(--nf-accent)] px-1 py-[1px] text-[8px] font-bold uppercase tracking-wide text-white">
                            {item.badge}
                          </span>
                        )}
                      </span>
                    }
                    subtitle={available ? item.hint : "No stream for this title"}
                    disabled={!available}
                    onClick={() => changePlayer(item.id)}
                  />
                );
              })}

              {anime && (
                <>
                  <p className="mt-1 px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    Anime audio
                  </p>
                  <Row
                    active={audio === "sub"}
                    title="Subbed"
                    subtitle="Japanese audio · subtitles on"
                    onClick={() => updateSettings({ animeAudio: "sub" })}
                  />
                  <Row
                    active={audio === "dub"}
                    title="Dubbed"
                    subtitle="English audio track"
                    onClick={() => updateSettings({ animeAudio: "dub" })}
                  />
                </>
              )}

              {player === "cinelite" ? (
                <>
                  <p className="mt-1 px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    Default quality
                  </p>
                  {QUALITIES.map((item) => (
                    <Row
                      key={item}
                      active={quality === item}
                      title={item.toUpperCase()}
                      onClick={() => changeQuality(item)}
                    />
                  ))}
                </>
              ) : (
                <p className="mt-1 flex items-start gap-1.5 px-2.5 pb-2 pt-2 text-[10.5px] leading-relaxed text-white/35">
                  <SubtitlesIcon width={13} height={13} className="mt-[1px] shrink-0" />
                  Quality, subtitles and audio live in {activePlayer.label}&apos;s own bar.
                </p>
              )}

              {title.kind === "series" && (
                <>
                  <p className="mt-1 border-t border-white/10 px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    Up next
                  </p>
                  {nextEp ? (
                    <Row
                      active={false}
                      title={`S${nextEp.season}:E${nextEp.episode} · ${
                        (seasons.find((s) => s.number === nextEp.season)?.episodes.find(
                          (e) => e.number === nextEp.episode,
                        )?.name) ?? "Next episode"
                      }`}
                      subtitle="Play next"
                      onClick={() => goTo(nextEp.season, nextEp.episode)}
                    />
                  ) : (
                    <p className="px-2.5 pb-2 text-[11px] text-white/35">You&apos;re on the last episode.</p>
                  )}

                  {currentSeason && (
                    <>
                      <p className="mt-1 px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                        Season {season}
                      </p>
                      <div className="max-h-[190px] overflow-y-auto">
                        {currentSeason.episodes.map((item) => (
                          <Row
                            key={item.number}
                            active={episode === item.number}
                            title={`E${item.number} · ${item.name}`}
                            subtitle={`${item.runtime} min`}
                            onClick={() => goTo(season, item.number)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="mt-1 flex items-center justify-between gap-2 border-t border-white/10 px-2.5 pb-2 pt-2">
                <span className="text-[10.5px] text-white/35">N · next episode</span>
                <button
                  type="button"
                  onClick={restart}
                  className="text-[10.5px] font-semibold text-white/55 transition hover:text-white"
                >
                  Restart stream
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* "nothing is playing" — one tap restarts the frame from a real click */}
        <AnimatePresence>
          {nudge && !paused && !upNext && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={restart}
              className="pointer-events-auto absolute bottom-4 left-3 flex items-center gap-2 rounded-full bg-[var(--nf-accent)] px-3.5 py-2 text-[12px] font-semibold text-white shadow-lg shadow-black/50 transition hover:brightness-110 md:bottom-6 md:left-6"
            >
              <PlayIcon width={13} height={13} />
              Stream paused? Tap to start
            </motion.button>
          )}
        </AnimatePresence>

        {/* up next card — Netflix-style, answers the "no next episode" gap */}
        <AnimatePresence>
          {upNext && nextEp && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto absolute bottom-[92px] right-3 z-30 w-[320px] max-w-[92vw] overflow-hidden rounded-lg border border-white/10 bg-[#0d0d0d]/95 shadow-[0_18px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl md:bottom-[104px] md:right-6"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.26em] text-[var(--nf-accent)]">
                  Up next
                </p>
                <span className="text-[10px] text-white/45">
                  in {Math.max(upNext.left, 0)}s
                </span>
              </div>

              <button
                type="button"
                onClick={() => goTo(nextEp.season, nextEp.episode)}
                className="group flex w-full items-center gap-2.5 p-2.5 text-left transition hover:bg-white/5"
              >
                <span className="relative block h-[54px] w-[96px] shrink-0 overflow-hidden rounded-[4px] bg-[#1b1b1b]">
                  <Artwork
                    slug={title.slug}
                    name={title.name}
                    kind="backdrop"
                    accent={title.accent}
                    sizes="96px"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition group-hover:opacity-100">
                    <PlayIcon width={14} height={14} />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-white">
                    S{nextEp.season}:E{nextEp.episode} ·{" "}
                    {(seasons
                      .find((s) => s.number === nextEp.season)
                      ?.episodes.find((e) => e.number === nextEp.episode)?.name) ?? "Next episode"}
                  </span>
                  <span className="mt-0.5 block truncate text-[10.5px] text-white/45">
                    {title.name} · {activePlayer.label}
                  </span>
                </span>
              </button>

              <div className="flex items-center gap-2 px-2.5 pb-2.5">
                <button
                  type="button"
                  onClick={() => goTo(nextEp.season, nextEp.episode)}
                  className="flex-1 rounded-[4px] bg-white py-1.5 text-[11.5px] font-semibold text-black transition hover:bg-white/85"
                >
                  Play next
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dismissed.current = true;
                    setUpNext(null);
                  }}
                  className="rounded-[4px] border border-white/20 px-3 py-1.5 text-[11.5px] font-medium text-white/75 transition hover:border-white/40 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* pause suggestions */}
        <AnimatePresence>
          {showRail && (
            <motion.aside
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto absolute bottom-[92px] right-3 z-20 w-[300px] max-w-[92vw] overflow-hidden rounded-lg border border-white/10 bg-[#0d0d0d]/94 shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl md:bottom-[104px] md:right-6 md:w-[460px]"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-3.5 py-2.5">
                <div>
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.26em] text-[var(--nf-accent)]">
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

        {/* wordmark while the stream boots */}
        <AnimatePresence>
          {!playing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-5 left-5 hidden md:block"
            >
              <Wordmark className="text-lg opacity-35" asLink={false} />
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
  disabled,
  onClick,
}: {
  title: React.ReactNode;
  subtitle?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition",
        active ? "bg-white/10" : "hover:bg-white/5",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
      )}
    >
      <span className="grid w-4 shrink-0 place-items-center text-[var(--nf-accent)]">
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
