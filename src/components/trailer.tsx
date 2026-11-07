"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { MuteIcon, VolumeIcon } from "@/components/icons";
import { openInOwnTab, soundIsBlocked } from "@/lib/media";
import { findTrailerList, trailerEmbedUrl } from "@/lib/trailer";
import { cn } from "@/lib/cn";

/**
 * Resolve every usable YouTube key for a title (TMDB first, Cinemeta as a
 * backstop) and walk the list when an embed refuses to play — that is what
 * makes the trailers that "never worked" work.
 */
export function useTrailerKeys(
  tmdbId?: number,
  kind: "movie" | "series" = "movie",
  delay = 350,
) {
  const [keys, setKeys] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!tmdbId) return;
    let alive = true;
    setKeys([]);
    setIndex(0);
    const timer = window.setTimeout(() => {
      void findTrailerList(tmdbId, kind).then((list) => {
        if (alive) setKeys(list);
      });
    }, delay);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [tmdbId, kind, delay]);

  const advance = useCallback(() => {
    setIndex((current) => (current + 1 < keys.length ? current + 1 : current));
  }, [keys.length]);

  return {
    videoId: keys[index] ?? null,
    keys,
    index,
    advance,
    hasMore: index < keys.length - 1,
  };
}

/** Back-compat: the first usable key. */
export function useTrailerKey(tmdbId?: number, kind: "movie" | "series" = "movie", delay = 350) {
  return useTrailerKeys(tmdbId, kind, delay).videoId;
}

/* ------------------------------------------------------------------ *
 * YouTube IFrame API — needed to mute/unmute without reloading.
 * ------------------------------------------------------------------ */

type YTPlayer = {
  playVideo: () => void;
  mute: () => void;
  unMute: () => void;
  setVolume: (volume: number) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

type YTNamespace = {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer;
};

let apiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));

  const scope = window as unknown as { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };
  if (scope.YT?.Player) return Promise.resolve(scope.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("yt-api-timeout")), 7000);
    scope.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      if (scope.YT?.Player) resolve(scope.YT);
      else reject(new Error("yt-api-missing"));
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("yt-api-error"));
    };
    document.head.appendChild(tag);
  });

  return apiPromise;
}

const PLAYING = 1;

type SoundState = {
  wantSound: boolean;
  attempt: number;
  needsTab: boolean;
  toggle: () => void;
  onAudioBlocked: () => void;
  onSoundOk: () => void;
};

/**
 * The escalation ladder for trailer audio:
 *   1. ask the running player to unmute,
 *   2. if the browser refuses, mute it back so the picture keeps moving, then
 *   3. rebuild the player *inside* the user's next click (the only route some
 *      browsers accept),
 *   4. and if the surrounding frame simply forbids audio, say so and offer a tab.
 */
function useTrailerSound(): SoundState {
  const [blockedUpFront] = useState(() => soundIsBlocked());
  const [wantSound, setWantSound] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [needsTab, setNeedsTab] = useState(() => blockedUpFront);
  const attemptRef = useRef(0);
  attemptRef.current = attempt;

  const toggle = useCallback(() => {
    if (wantSound) {
      setWantSound(false);
      return;
    }
    if (failed) {
      setFailed(false);
      setAttempt((a) => a + 1);
    }
    setWantSound(true);
  }, [wantSound, failed]);

  const onAudioBlocked = useCallback(() => {
    setWantSound(false);
    setFailed(true);
    /* two refusals in a row means this frame will never allow audio */
    if (attemptRef.current >= 2) setNeedsTab(true);
  }, []);

  const onSoundOk = useCallback(() => setNeedsTab(false), []);

  return { wantSound, attempt, needsTab, toggle, onAudioBlocked, onSoundOk };
}

/**
 * The trailer itself.
 *
 * Rule one: it must never sit frozen. If sound is refused we mute, resume and
 * report it upward rather than leaving a dead poster on screen.
 */
export function TrailerFrame({
  videoId,
  wantSound,
  attempt,
  onAudioBlocked,
  onSoundOk,
  onFail,
  className,
}: {
  videoId: string;
  wantSound: boolean;
  attempt: number;
  onAudioBlocked?: () => void;
  onSoundOk?: () => void;
  /** called when YouTube refuses this video (age gate, embedding disabled, …) */
  onFail?: () => void;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const wantSoundRef = useRef(wantSound);
  wantSoundRef.current = wantSound;
  const blockedHandler = useRef(onAudioBlocked);
  blockedHandler.current = onAudioBlocked;
  const okHandler = useRef(onSoundOk);
  okHandler.current = onSoundOk;
  const failHandler = useRef(onFail);
  failHandler.current = onFail;
  const resumeAt = useRef(0);
  const [fallback, setFallback] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  /** ask for audio; if the browser says no, re-mute and keep the picture moving */
  const requestSound = useCallback((instance: YTPlayer) => {
    try {
      instance.unMute();
      instance.setVolume(90);
      instance.playVideo();
    } catch {
      /* ignore */
    }

    window.setTimeout(() => {
      if (!wantSoundRef.current) return; // user changed their mind — stay quiet
      let state = -1;
      try {
        state = instance.getPlayerState();
      } catch {
        return;
      }
      if (state === PLAYING) {
        okHandler.current?.();
        return;
      }
      try {
        instance.mute();
        instance.playVideo();
      } catch {
        /* ignore */
      }
      blockedHandler.current?.();
    }, 1500);
  }, []);

  const ensurePlaying = useCallback(() => {
    const instance = player.current;
    if (!instance) return;
    try {
      const state = instance.getPlayerState();
      if (state !== PLAYING) instance.playVideo();
      else resumeAt.current = instance.getCurrentTime();
    } catch {
      /* not ready */
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    void loadYouTubeApi()
      .then((YT) => {
        if (disposed || !host.current) return;

        const mount = document.createElement("div");
        host.current.replaceChildren(mount);

        /* attempt > 0 = the user asked for sound again; build the player with
           audio on, inside their click */
        const startWithSound = attempt > 0 && wantSoundRef.current;

        const instance = new YT.Player(mount, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            mute: startWithSound ? 0 : 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            playsinline: 1,
            loop: 1,
            playlist: videoId,
            disablekb: 1,
            fs: 0,
            start: Math.max(0, Math.floor(resumeAt.current)),
            origin: window.location.origin,
          },
          events: {
            onError: () => {
              /* 2 / 5 / 100 / 101 / 150 — dead video or embedding blocked */
              failHandler.current?.();
            },
            onReady: () => {
              player.current = instance;
              try {
                instance.playVideo();
              } catch {
                /* ignore */
              }
              if (wantSoundRef.current) requestSound(instance);
            },
          },
        });

        player.current = instance;
      })
      .catch(() => {
        if (!disposed) setFallback(true);
      });

    /* a trailer must never sit paused */
    const guard = window.setInterval(ensurePlaying, 1500);

    /* …and if it never starts at all, try the next candidate key */
    const deadTimer = window.setTimeout(() => {
      if (!player.current) return;
      try {
        if (player.current.getPlayerState() === -1 || player.current.getPlayerState() === 5) {
          failHandler.current?.();
        }
      } catch {
        failHandler.current?.();
      }
    }, 9000);

    return () => {
      disposed = true;
      window.clearTimeout(deadTimer);
      window.clearInterval(guard);
      const instance = player.current;
      player.current = null;
      try {
        instance?.destroy();
      } catch {
        /* already gone */
      }
    };
  }, [videoId, attempt, requestSound, ensurePlaying]);

  /* mute / unmute from the UI, without reloading the video */
  useEffect(() => {
    const instance = player.current;
    if (!instance) return;
    if (wantSound) {
      requestSound(instance);
    } else {
      try {
        instance.mute();
        instance.playVideo();
      } catch {
        /* ignore */
      }
    }
  }, [wantSound, videoId, requestSound]);

  const key = `${wantSound ? "s" : "m"}${attempt}`;

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden bg-black", className)}>
      {fallback ? (
        <iframe
          key={key}
          src={trailerEmbedUrl(videoId, origin, wantSound)}
          title="Trailer"
          aria-hidden
          tabIndex={-1}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-0"
          style={{ width: "100%", aspectRatio: "16 / 9", minHeight: "100%" }}
        />
      ) : (
        <div
          ref={host}
          className="absolute inset-0 scale-[1.3] [&>div]:h-full [&>div]:w-full [&_iframe]:h-full [&_iframe]:w-full"
        />
      )}
    </div>
  );
}

function SoundHint({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openInOwnTab}
      className={cn(
        "focus-brand pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/25 bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur transition hover:border-white hover:bg-black/85",
        className,
      )}
    >
      <MuteIcon width={13} height={13} />
      Sound needs its own tab
      <span aria-hidden>↗</span>
    </button>
  );
}

/** Trailer for the title modal header. */
export function TrailerStage({ videoId, onFail }: { videoId: string; onFail?: () => void }) {
  const { wantSound, attempt, needsTab, toggle, onAudioBlocked, onSoundOk } = useTrailerSound();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="pointer-events-none absolute inset-0"
    >
      <TrailerFrame
        videoId={videoId}
        wantSound={wantSound}
        attempt={attempt}
        onAudioBlocked={onAudioBlocked}
        onSoundOk={onSoundOk}
      />

      {needsTab && <SoundHint className="absolute bottom-3 left-3 z-20" />}

      <button
        type="button"
        onClick={toggle}
        aria-label={wantSound ? "Mute trailer" : "Turn trailer sound on"}
        title={needsTab ? "This frame blocks sound — open the site in its own tab" : undefined}
        className="focus-brand pointer-events-auto absolute bottom-3 right-3 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/40 bg-black/55 text-white backdrop-blur transition hover:border-white hover:bg-black/75"
      >
        {wantSound ? <VolumeIcon width={16} height={16} /> : <MuteIcon width={16} height={16} />}
      </button>
    </motion.div>
  );
}

/** The trailer behind a title page hero, with the same sound ladder. */
export function HeroTrailer({ tmdbId, kind }: { tmdbId: number; kind: "movie" | "series" }) {
  const videoId = useTrailerKey(tmdbId, kind, 500);
  const { wantSound, attempt, needsTab, toggle, onAudioBlocked, onSoundOk } = useTrailerSound();

  if (!videoId) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9 }}
        className="pointer-events-none absolute inset-0"
      >
        <TrailerFrame
          videoId={videoId}
          wantSound={wantSound}
          attempt={attempt}
          onAudioBlocked={onAudioBlocked}
          onSoundOk={onSoundOk}
        />
      </motion.div>

      {needsTab && <SoundHint className="absolute bottom-4 right-4 z-20 hidden md:right-12 md:flex" />}

      <button
        type="button"
        onClick={toggle}
        aria-label={wantSound ? "Mute trailer" : "Turn trailer sound on"}
        title={needsTab ? "This frame blocks sound — open the site in its own tab" : "Trailer sound"}
        className="focus-brand absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/35 bg-black/45 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur transition hover:border-white hover:bg-black/70 hover:text-white md:right-12"
      >
        {wantSound ? <VolumeIcon width={14} height={14} /> : <MuteIcon width={14} height={14} />}
        {wantSound ? "Sound on" : "Sound off"}
      </button>
    </>
  );
}
