"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
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

/**
 * Muted, chromeless, looping trailer that fills its container.
 * Sound is toggled through the player's own postMessage API, so flipping it
 * never restarts the video.
 */
export function TrailerFrame({
  videoId,
  muted,
  className,
}: {
  videoId: string;
  muted: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const command = (func: string, args: unknown[] = []) => {
    try {
      ref.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
    } catch {
      /* the video simply stays muted */
    }
  };

  /* give the player a moment to boot, then make sure it is rolling */
  useEffect(() => {
    const timers = [
      window.setTimeout(() => {
        command("playVideo");
        command(muted ? "mute" : "unMute");
      }, 1100),
      window.setTimeout(() => {
        command("playVideo");
        command("setVolume", [75]);
      }, 2400),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    command(muted ? "mute" : "unMute");
    if (!muted) command("setVolume", [75]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, videoId]);

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden bg-black", className)}>
      <iframe
        ref={ref}
        src={trailerEmbedUrl(videoId, origin)}
        title="Trailer"
        aria-hidden
        tabIndex={-1}
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-0"
        style={{ width: "100%", aspectRatio: "16 / 9", minHeight: "100%" }}
      />
    </div>
  );
}

/** Trailer with a sound toggle — used in the title modal header and hero. */
export function TrailerStage({
  videoId,
  className,
  soundButtonClassName,
  showSoundButton = true,
}: {
  videoId: string;
  className?: string;
  soundButtonClassName?: string;
  showSoundButton?: boolean;
}) {
  const [muted, setMuted] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="pointer-events-none absolute inset-0"
    >
      <TrailerFrame videoId={videoId} muted={muted} className={className} />

      {showSoundButton && (
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Turn trailer sound on" : "Mute trailer"}
          className={cn(
            "focus-brand pointer-events-auto absolute bottom-3 right-3 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/40 bg-black/50 text-white backdrop-blur transition hover:border-white hover:bg-black/70",
            soundButtonClassName,
          )}
        >
          {muted ? <MuteIcon width={16} height={16} /> : <VolumeIcon width={16} height={16} />}
        </button>
      )}
    </motion.div>
  );
}

/**
 * The trailer that plays behind a title page hero as soon as it resolves.
 * Renders nothing when a title has no trailer, leaving the artwork untouched.
 */
export function HeroTrailer({
  tmdbId,
  kind,
}: {
  tmdbId: number;
  kind: "movie" | "series";
}) {
  const videoId = useTrailerKey(tmdbId, kind, 500);
  const [muted, setMuted] = useState(true);

  if (!videoId) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9 }}
        className="pointer-events-none absolute inset-0"
      >
        <TrailerFrame videoId={videoId} muted={muted} />
      </motion.div>

      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "Turn trailer sound on" : "Mute trailer"}
        className="focus-brand absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/35 bg-black/45 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur transition hover:border-white hover:bg-black/70 hover:text-white md:right-12"
      >
        {muted ? <MuteIcon width={14} height={14} /> : <VolumeIcon width={14} height={14} />}
        {muted ? "Trailer" : "Sound on"}
      </button>
    </>
  );
}
