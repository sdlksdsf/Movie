"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { MuteIcon, VolumeIcon } from "@/components/icons";
import { findTrailer, trailerEmbedUrl } from "@/lib/trailer";
import { cn } from "@/lib/cn";

/** Resolve (and cache) the YouTube key for a title, starting after `delay` ms. */
export function useTrailerKey(tmdbId?: number, kind: "movie" | "series" = "movie", delay = 350) {
  const [videoId, setVideoId] = useState<string | null>(null);

  useEffect(() => {
    if (!tmdbId) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      void findTrailer(tmdbId, kind).then((key) => {
        if (alive && key) setVideoId(key);
      });
    }, delay);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [tmdbId, kind, delay]);

  return videoId;
}

/* ------------------------------------------------------------------ *
 * YouTube IFrame API — the only way to mute/unmute a trailer without
 * reloading it. Loaded once per page, with a plain-iframe fallback.
 * ------------------------------------------------------------------ */

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
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
const PAUSED = 2;
const ENDED = 0;
const CUED = 5;

/**
 * Muted-or-not, chromeless, looping trailer that covers its container.
 *
 * Playback protection matters more than anything here: if the browser blocks
 * sound, or the player pauses itself, we mute and restart it rather than
 * leaving the viewer staring at a frozen frame.
 */
export function TrailerFrame({
  videoId,
  muted,
  onSoundBlocked,
  className,
}: {
  videoId: string;
  muted: boolean;
  onSoundBlocked?: () => void;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const blockedRef = useRef(onSoundBlocked);
  blockedRef.current = onSoundBlocked;
  const [fallback, setFallback] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const ensurePlaying = useCallback(() => {
    const instance = player.current;
    if (!instance) return;
    try {
      const state = instance.getPlayerState();
      if (state === PAUSED || state === CUED || state === ENDED) instance.playVideo();
    } catch {
      /* player not ready yet */
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    void loadYouTubeApi()
      .then((YT) => {
        if (disposed || !host.current) return;

        const mount = document.createElement("div");
        host.current.replaceChildren(mount);

        const instance = new YT.Player(mount, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            mute: 1, // guaranteed start; sound is switched on right below
            controls: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            playsinline: 1,
            loop: 1,
            playlist: videoId,
            disablekb: 1,
            fs: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              player.current = instance;
              instance.playVideo();

              if (!mutedRef.current) {
                /* try for sound straight away — the card was opened by a click,
                   so the page has the activation a browser needs */
                instance.unMute();
                instance.setVolume(85);
                instance.playVideo();

                window.setTimeout(() => {
                  if (disposed || mutedRef.current) return;
                  let state = -1;
                  try {
                    state = instance.getPlayerState();
                  } catch {
                    /* ignore */
                  }
                  if (state !== PLAYING) {
                    /* the browser refused: go muted but never frozen */
                    instance.mute();
                    instance.playVideo();
                    mutedRef.current = true;
                    blockedRef.current?.();
                  }
                }, 1500);
              }
            },
          },
        });

        player.current = instance;
      })
      .catch(() => {
        if (!disposed) setFallback(true);
      });

    /* watchdog: a trailer must never sit paused */
    const guard = window.setInterval(ensurePlaying, 1500);

    return () => {
      disposed = true;
      window.clearInterval(guard);
      const instance = player.current;
      player.current = null;
      try {
        instance?.destroy();
      } catch {
        /* already gone */
      }
    };
  }, [videoId, ensurePlaying]);

  /* sound toggle — takes effect immediately, no reload, and resumes playback */
  useEffect(() => {
    const instance = player.current;
    if (!instance) return;
    try {
      if (muted) {
        instance.mute();
      } else {
        instance.unMute();
        instance.setVolume(85);
      }
      instance.playVideo();
    } catch {
      /* ignore */
    }
  }, [muted, videoId]);

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden bg-black", className)}>
      {fallback ? (
        <iframe
          key={muted ? "muted" : "sound"}
          src={trailerEmbedUrl(videoId, origin, !muted)}
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

/** Trailer plus a working sound button — used in the title modal. */
export function TrailerStage({ videoId }: { videoId: string }) {
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);

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
        muted={muted}
        onSoundBlocked={() => {
          setMuted(true);
          setBlocked(true);
        }}
      />

      <button
        type="button"
        onClick={() => {
          setMuted((m) => !m);
          setBlocked(false);
        }}
        aria-label={muted ? "Turn trailer sound on" : "Mute trailer"}
        title={blocked ? "Your browser started the trailer muted — tap for sound" : undefined}
        className="focus-brand pointer-events-auto absolute bottom-3 right-3 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/40 bg-black/55 text-white backdrop-blur transition hover:border-white hover:bg-black/75"
      >
        {muted ? <MuteIcon width={16} height={16} /> : <VolumeIcon width={16} height={16} />}
      </button>
    </motion.div>
  );
}

/**
 * The trailer that plays behind a title page hero.
 * Renders nothing when a title has no trailer, leaving the artwork untouched.
 */
export function HeroTrailer({ tmdbId, kind }: { tmdbId: number; kind: "movie" | "series" }) {
  const videoId = useTrailerKey(tmdbId, kind, 500);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);

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
          muted={muted}
          onSoundBlocked={() => {
            setMuted(true);
            setBlocked(true);
          }}
        />
      </motion.div>

      <button
        type="button"
        onClick={() => {
          setMuted((m) => !m);
          setBlocked(false);
        }}
        aria-label={muted ? "Turn trailer sound on" : "Mute trailer"}
        title={blocked ? "Started muted by your browser — tap for sound" : undefined}
        className="focus-brand absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/35 bg-black/45 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur transition hover:border-white hover:bg-black/70 hover:text-white md:right-12"
      >
        {muted ? <MuteIcon width={14} height={14} /> : <VolumeIcon width={14} height={14} />}
        {muted ? "Sound off" : "Sound on"}
      </button>
    </>
  );
}
