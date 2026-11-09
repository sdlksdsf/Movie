"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FullscreenIcon,
  ChevronDownIcon,
  MuteIcon,
  PauseIcon,
  PlayIcon,
  ForwardIcon,
  RewindIcon,
  SubtitlesIcon,
  VolumeIcon,
} from "@/components/icons";
import { cn } from "@/lib/cn";

export type NativeSource = {
  /** the CDN itself — played straight from the viewer's IP */
  url: string;
  /** signed same-origin relay, used only if the CDN refuses the direct hit */
  proxy?: string;
  type: "hls" | "mp4";
  quality?: string;
  codec?: "h264" | "hevc" | "unknown";
  label: string;
};

/** Can this browser decode HEVC? Plenty of provider files are h265-only. */
function hevcSupported() {
  if (typeof document === "undefined") return true;
  try {
    const probe = document.createElement("video");
    return (
      probe.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') !== "" ||
      probe.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"') !== ""
    );
  } catch {
    return false;
  }
}

const fmt = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const total = Math.floor(value);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

type Level = { index: number; label: string };

/**
 * NOFLIX's own player.
 *
 * hls.js owns the transport, we own every pixel: Netflix-shaped controls,
 * resume, quality, captions, PiP, fullscreen and keyboard shortcuts. No
 * third-party iframe, no someone else's menu, no ads on top of the picture.
 */
export function NativePlayer({
  sources,
  title,
  startAt,
  autoPlay = true,
  onTick,
  onEnded,
  onError,
  onNext,
  nextLabel,
}: {
  sources: NativeSource[];
  title: string;
  startAt?: number | null;
  autoPlay?: boolean;
  onTick?: (state: { current: number; total: number }) => void;
  onEnded?: () => void;
  onError?: () => void;
  /** play the next episode — powers the Netflix-style end card */
  onNext?: () => void;
  nextLabel?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const videoEl = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    /* no `crossOrigin`: provider CDNs rarely send CORS headers, and a plain
       media load plays opaquely. And no Referer, which is exactly what their
       hotlink checks look at — React's typings just don't know the attribute. */
    if (node) node.setAttribute("referrerpolicy", "no-referrer");
  }, []);
  const shellRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const lastSaved = useRef(0);
  const recovery = useRef({ network: 0, media: 0, escalated: false });

  const [sourceIndex, setSourceIndex] = useState(0);
  /** 0 = straight to the CDN, 1 = through our relay */
  const [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [menu, setMenu] = useState<null | "quality" | "captions" | "source" | "speed" | "audio">(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [level, setLevel] = useState(-1);
  const [captionTracks, setCaptionTracks] = useState<Level[]>([]);
  const [caption, setCaption] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<Level[]>([]);
  const [audio, setAudio] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);
  const [flash, setFlash] = useState<null | "back" | "forward">(null);
  const [slow, setSlow] = useState(false);
  const [nextIn, setNextIn] = useState<number | null>(null);
  const [generation, setGeneration] = useState(0);
  const nextFired = useRef(false);
  const tap = useRef({ at: 0, x: 0, timer: 0 });

  /* drop h265-only files when this browser cannot decode them: a black screen
     is worse than starting on a lower resolution */
  const playable = useMemo(() => {
    const supportsHevc = hevcSupported();
    const keep = sources.filter((entry) => supportsHevc || entry.codec !== "hevc");
    return keep.length ? keep : supportsHevc ? sources : [];
  }, [sources]);

  /**
   * How each source is attempted, in order.
   *
   * hls.js fetches playlists with XHR, so a cross-origin CDN has to answer with
   * CORS headers — most of these hosts do not. The relay is same-origin, so HLS
   * goes through it first and only tries the CDN directly as a fallback.
   * A plain MP4 load is opaque to the browser and needs no CORS, so it goes
   * straight to the CDN (which is kind to residential IPs) and relays second.
   */
  const attempts = useMemo(
    () =>
      playable.map((entry) => {
        const relay = entry.proxy;
        const direct = entry.url;
        return entry.type === "hls"
          ? [relay, direct].filter(Boolean) as string[]
          : [direct, relay].filter(Boolean) as string[];
      }),
    [playable],
  );

  const sourceKey = useMemo(
    () => playable.map((entry) => `${entry.url}|${entry.proxy ?? ""}`).join("~"),
    [playable],
  );

  /* a new title means a new source list: start again from the first one */
  useEffect(() => {
    setSourceIndex(0);
    setAttempt(0);
  }, [sourceKey]);

  /* ------------------------------------------------------------- transport */

  useEffect(() => {
    const video = videoRef.current;
    const source = playable[sourceIndex];
    const url = source ? (attempts[sourceIndex]?.[attempt] ?? null) : null;
    if (!video || !source || !url) return;

    let hls: import("hls.js").default | null = null;
    let cancelled = false;

    setWaiting(true);
    setFailed(false);
    setLevels([]);
    setCaptionTracks([]);
    recovery.current = { network: 0, media: 0, escalated: false };

    const resumeAt = startAt && startAt > 20 ? startAt : 0;
    const nudgeResume = () => {
      if (!resumeAt) return;
      if (Number.isFinite(video.duration) && Math.abs(video.currentTime - resumeAt) > 3) {
        video.currentTime = resumeAt;
      }
    };

    const startPlayback = () => {
      if (!autoPlay) return;
      void video
        .play()
        .then(() => setWaiting(false))
        .catch(() => {
          /* most browsers only allow muted autoplay until a gesture */
          video.muted = true;
          setMuted(true);
          void video.play().catch(() => setWaiting(false));
        });
    };

    /** timers + element listeners we have to detach ourselves */
    const stalls: { src?: number } = {};
    let mediaErrorHandler: (() => void) | null = null;

    /**
     * Give up on this attempt: the CDN refused, so relay it; the relay refused,
     * so move to the next source; nothing left, so hand the page to the embeds.
     */
    const escalate = () => {
      if (recovery.current.escalated) return;
      recovery.current.escalated = true;
      if (attempt + 1 < (attempts[sourceIndex]?.length ?? 1)) {
        setAttempt(attempt + 1);
        return;
      }
      if (sourceIndex + 1 < playable.length) {
        setSourceIndex((index) => index + 1);
        setAttempt(0);
        return;
      }
      setFailed(true);
      onError?.();
    };

    const bootstrap = async () => {
      /* hls.js first whenever it can drive the file: it is the only path that
         gives us a quality menu, audio tracks and clean error reporting. The
         element's own HLS path stays for iOS/Safari and for MP4. */
      if (source.type === "mp4") {
        /* the platform's own HLS/MP4 path (Safari, iOS): no hls.js involved, so
           the element itself has to tell us when a source is dead */
        mediaErrorHandler = () => escalate();
        video.addEventListener("error", mediaErrorHandler);
        stalls.src = window.setTimeout(() => {
          if (video.readyState < 2) escalate();
        }, 25_000);
        video.addEventListener(
          "playing",
          () => window.clearTimeout(stalls.src),
          { once: true },
        );
        video.src = url;
        video.addEventListener("loadedmetadata", nudgeResume, { once: true });
        startPlayback();
        return;
      }

      const module = await import("hls.js");
      const Hls = module.default;
      if (cancelled) return;

      if (!Hls.isSupported()) {
        /* Safari/iOS (or an ancient browser): the element plays HLS itself */
        if (!video.canPlayType("application/vnd.apple.mpegurl")) {
          escalate();
          return;
        }
        mediaErrorHandler = () => escalate();
        video.addEventListener("error", mediaErrorHandler);
        stalls.src = window.setTimeout(() => {
          if (video.readyState < 2) escalate();
        }, 25_000);
        video.src = url;
        video.addEventListener("loadedmetadata", nudgeResume, { once: true });
        startPlayback();
        return;
      }

      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 12_000,
        levelLoadingTimeOut: 12_000,
        fragLoadingTimeOut: 20_000,
        /* The CDNs hotlink on Referer, and a browser never lets us clear it on an
           XHR — but it does honour `referrerPolicy`. `context.url` is often a
           *relative* /api/hls path, and `new Request()` throws on those, which
           silently killed every playlist; resolve it against the page first. */
        fetchSetup: (context: { url: string }, initParams: RequestInit) =>
          new Request(new URL(context.url, window.location.href).toString(), {
            ...initParams,
            referrerPolicy: "no-referrer",
            credentials: "omit",
          }),
      });

      hlsRef.current = hls;
      hls.attachMedia(video);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => hls?.loadSource(url));
      hls.on(Hls.Events.MANIFEST_PARSED, (_event: unknown, data: { levels: Array<{ height?: number; bitrate?: number }> }) => {
        setLevels(
          data.levels.map((entry, index) => ({
            index,
            label: entry.height ? `${entry.height}p` : `${Math.round((entry.bitrate ?? 0) / 1000)}k`,
          })),
        );
        nudgeResume();
        startPlayback();
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event: unknown, data: { level: number }) => setLevel(data.level));
      hls.on(
        Hls.Events.AUDIO_TRACKS_UPDATED,
        (_event: unknown, data: { audioTracks: Array<{ name?: string; lang?: string }> }) => {
          setAudioTracks(
            data.audioTracks.map((track, index) => ({
              index,
              label: track.name || track.lang?.toUpperCase() || `Audio ${index + 1}`,
            })),
          );
        },
      );
      hls.on(
        Hls.Events.SUBTITLE_TRACKS_UPDATED,
        (_event: unknown, data: { subtitleTracks: Array<{ name?: string; lang?: string }> }) => {
          setCaptionTracks(
            data.subtitleTracks.map((track, index) => ({
              index,
              label: track.name || track.lang || `Track ${index + 1}`,
            })),
          );
        },
      );
      const escalateInside = escalate;

      hls.on(Hls.Events.ERROR, (_event: unknown, data: { fatal: boolean; type: string }) => {
        if (!data.fatal || !hls) return;
        /* a few recoveries per source, then hand over to the next one — never
           retry the same dead manifest forever */
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (recovery.current.network < 2) {
            recovery.current.network += 1;
            hls.startLoad();
            return;
          }
          escalateInside();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          if (recovery.current.media < 2) {
            recovery.current.media += 1;
            hls.recoverMediaError();
            return;
          }
          escalateInside();
          return;
        }
        escalateInside();
      });
    };

    void bootstrap();

    return () => {
      cancelled = true;
      window.clearTimeout(stalls.src);
      if (mediaErrorHandler) video.removeEventListener("error", mediaErrorHandler);
      hlsRef.current = null;
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, sourceIndex, attempt, generation]);

  /* --------------------------------------------------------------- listeners */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const sync = () => {
      setTime(video.currentTime);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      const ranges = video.buffered;
      if (ranges.length) setBuffered(ranges.end(ranges.length - 1));
    };
    const onPlay = () => {
      setPlaying(true);
      setWaiting(false);
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onVolume = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const onEnded = () => {
      setPlaying(false);
      onTick?.({ current: video.duration || 0, total: video.duration || 0 });
      onEnded?.();
    };
    const onTime = () => {
      sync();
      const now = Date.now();
      if (onTick && now - lastSaved.current > 5000) {
        lastSaved.current = now;
        onTick({ current: video.currentTime, total: video.duration || 0 });
      }
    };

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("progress", sync);
    video.addEventListener("durationchange", sync);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("progress", sync);
      video.removeEventListener("durationchange", sync);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("ended", onEnded);
    };
  }, [onTick, onEnded]);

  /* playback speed, remembered across episodes */
  useEffect(() => {
    const stored = Number(window.localStorage.getItem("nf.speed"));
    if (Number.isFinite(stored) && stored >= 0.5 && stored <= 2) setSpeed(stored);
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
    try {
      window.localStorage.setItem("nf.speed", String(speed));
    } catch {
      /* private mode */
    }
  }, [speed]);

  useEffect(() => {
    if (hlsRef.current) hlsRef.current.audioTrack = audio;
  }, [audio]);

  /* a first segment should arrive in a second or two; if it does not, say so */
  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), 4500);
    return () => window.clearTimeout(timer);
  }, [waiting, sourceIndex, attempt, generation]);

  /* user picks a quality / caption track → apply it to the engine */
  useEffect(() => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = level;
  }, [level]);

  useEffect(() => {
    if (!hlsRef.current) return;
    hlsRef.current.subtitleTrack = caption;
  }, [caption]);

  /* Netflix-style end card: offer the next episode during the last 25s */
  useEffect(() => {
    if (!onNext || !duration) {
      setNextIn(null);
      return;
    }
    const left = duration - time;
    if (left > 25 || left < 0) {
      setNextIn(null);
      return;
    }
    setNextIn(Math.max(0, Math.ceil(left)));
  }, [duration, time, onNext]);

  useEffect(() => {
    if (nextIn !== 0 || nextFired.current || !onNext) return;
    nextFired.current = true;
    onNext();
  }, [nextIn, onNext]);

  useEffect(() => {
    nextFired.current = false;
    setNextIn(null);
  }, [sourceKey]);

  /* ---------------------------------------------------------------- controls */

  const poke = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChrome(false), 2800);
  }, []);

  useEffect(() => {
    poke();
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [poke]);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), video.duration || 0);
  }, []);

  const seekTo = useCallback((ratio: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(1, ratio)) * video.duration;
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 1;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void shell.requestFullscreen?.().catch(() => undefined);
  }, []);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      /* unsupported */
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();
          toggle();
          break;
        case "arrowright":
          seekBy(10);
          poke();
          break;
        case "arrowleft":
          seekBy(-10);
          poke();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "m":
          toggleMute();
          break;
        case "j":
          seekBy(-10);
          poke();
          break;
        case "l":
          seekBy(10);
          poke();
          break;
        case "arrowup":
          event.preventDefault();
          if (videoRef.current) videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
          poke();
          break;
        case "arrowdown":
          event.preventDefault();
          if (videoRef.current) videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
          poke();
          break;
        case "escape":
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [poke, seekBy, toggle, toggleFullscreen, toggleMute]);

  /** start the whole chain again — sources change, tokens expire, CDNs blink */
  const retryAll = useCallback(() => {
    nextFired.current = false;
    setFailed(false);
    setSourceIndex(0);
    setAttempt(0);
    setGeneration((value) => value + 1);
  }, []);

  /**
   * One surface for taps: a second tap inside 320ms on the left/right third is
   * a double-tap seek (how Netflix behaves on a phone), anything else is
   * play/pause after a short wait so the two do not fight.
   */
  const onSurfaceTap = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const now = Date.now();
      const doubled = now - tap.current.at < 320 && Math.abs(x - tap.current.x) < 140;

      if (doubled) {
        window.clearTimeout(tap.current.timer);
        tap.current = { at: 0, x, timer: 0 };
        const back = x < rect.width * 0.38;
        seekBy(back ? -10 : 10);
        setFlash(back ? "back" : "forward");
        window.setTimeout(() => setFlash(null), 520);
        return;
      }

      tap.current.at = now;
      tap.current.x = x;
      tap.current.timer = window.setTimeout(() => {
        toggle();
        poke();
      }, 250);
    },
    [poke, seekBy, toggle],
  );

  const scrub = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    seekTo((event.clientX - rect.left) / rect.width);
  };

  const progress = duration > 0 ? (time / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;

  return (
    <div
      ref={shellRef}
      onMouseMove={poke}
      onTouchStart={poke}
      className="group absolute inset-0 z-20 bg-black text-white"
    >
      <video
        ref={videoEl}
        playsInline
        preload="metadata"
        className="h-full w-full bg-black object-contain"
      />

      {/* taps: play/pause, or double-tap either side to jump 10s */}
      <div className="absolute inset-0 z-10" onPointerUp={onSurfaceTap} />

      {flash && (
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 z-20 grid w-1/3 place-items-center bg-white/10",
            flash === "back" ? "left-0 rounded-r-full" : "right-0 rounded-l-full",
          )}
        >
          <span className="flex items-center gap-1 text-[13px] font-semibold text-white/90">
            {flash === "back" ? <RewindIcon width={18} height={18} /> : <ForwardIcon width={18} height={18} />}10s
          </span>
        </div>
      )}

      {/* buffering */}
      {waiting && !failed && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <div className="flex flex-col items-center gap-3">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-[var(--nf-accent)]" />
            {slow && (
              <p className="text-[12px] font-medium text-white/60">
                Connecting to {playable[sourceIndex]?.label ?? "the stream"}…
              </p>
            )}
          </div>
        </div>
      )}

      {/* fatal: every source refused */}
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-black/85 px-6 text-center">
          <div>
            <p className="text-[15px] font-semibold">This title didn&apos;t start in the NOFLIX player</p>
            <p className="mt-1 text-[12.5px] text-white/55">
              Switch to a backup server from the menu — the embeds are still there.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={retryAll}
                className="rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-black"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => onError?.()}
                className="rounded-full bg-white/15 px-4 py-2 text-[12.5px] font-semibold text-white"
              >
                Backup server
              </button>
            </div>
            <p className="mt-2 text-[11px] text-white/35">
              {playable.length} source{playable.length === 1 ? "" : "s"} tried ·{" "}
              {playable.map((entry) => entry.label).join(", ") || "none available"}
            </p>
          </div>
        </div>
      )}

      {/* centre play affordance (the tap surface owns the click) */}
      {!playing && !waiting && !failed && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-black/55 ring-2 ring-white/70 backdrop-blur-sm">
            <PlayIcon width={22} height={22} />
          </span>
        </div>
      )}

      {/* skip intro */}
      {playing && time > 5 && time < 95 && (
        <button
          type="button"
          onClick={() => {
            seekBy(85);
            poke();
          }}
          className="absolute bottom-24 right-4 z-30 rounded-md bg-white/90 px-3.5 py-2 text-[12px] font-semibold text-black shadow-lg transition hover:bg-white md:right-6"
        >
          Skip intro
        </button>
      )}

      {/* next episode card, like the real thing */}
      {nextIn !== null && onNext && !failed && (
        <div className="absolute bottom-24 right-4 z-30 w-[228px] rounded-lg border border-white/10 bg-[#141414]/95 p-3 shadow-2xl backdrop-blur-xl md:right-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
            {nextIn > 0 ? `Next episode in ${nextIn}` : "Next episode"}
          </p>
          <p className="mt-1 truncate text-[13px] font-semibold">{nextLabel ?? "Up next"}</p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                nextFired.current = true;
                onNext();
              }}
              className="flex-1 rounded-md bg-white px-3 py-1.5 text-[12px] font-semibold text-black"
            >
              Play now
            </button>
            <button
              type="button"
              onClick={() => {
                nextFired.current = true;
                setNextIn(null);
              }}
              className="rounded-md bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* chrome */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-3 pb-3 pt-12 transition-opacity duration-200 md:px-5 md:pb-4",
          chrome ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="pointer-events-auto">
          {/* seek bar */}
          <div
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            tabIndex={0}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              scrub(event);
            }}
            onPointerMove={(event) => {
              if (event.buttons === 1) scrub(event);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") seekBy(10);
              if (event.key === "ArrowLeft") seekBy(-10);
            }}
            className="group/seek relative h-4 cursor-pointer touch-none select-none"
          >
            <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/25" />
            <span
              className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/40"
              style={{ width: `${bufferedPct}%` }}
            />
            <span
              className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[var(--nf-accent)]"
              style={{ width: `${progress}%` }}
            />
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--nf-accent)] opacity-0 transition group-hover/seek:opacity-100"
              style={{ left: `${progress}%` }}
            />
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 md:gap-2.5">
            <button type="button" onClick={() => seekBy(-10)} aria-label="Back 10 seconds" className="p-1.5 text-white/85 hover:text-white">
              <RewindIcon width={17} height={17} />
            </button>
            <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="p-1.5 text-white hover:text-white/80">
              {playing ? <PauseIcon width={19} height={19} /> : <PlayIcon width={19} height={19} />}
            </button>
            <button type="button" onClick={() => seekBy(10)} aria-label="Forward 10 seconds" className="p-1.5 text-white/85 hover:text-white">
              <ForwardIcon width={17} height={17} />
            </button>

            <div className="ml-1 flex items-center gap-1.5">
              <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="p-1.5 text-white/85 hover:text-white">
                {muted || volume === 0 ? <MuteIcon width={17} height={17} /> : <VolumeIcon width={17} height={17} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(event) => {
                  const video = videoRef.current;
                  if (!video) return;
                  const next = Number(event.target.value);
                  video.volume = next;
                  video.muted = next === 0;
                }}
                aria-label="Volume"
                className="hidden h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/30 accent-white sm:block"
              />
            </div>

            <span className="ml-1 text-[11.5px] tabular-nums text-white/70">
              {fmt(time)} <span className="text-white/35">/ {fmt(duration)}</span>
            </span>

            <div className="ml-auto flex items-center gap-1">
              {/* source switch */}
              {playable.length > 1 && (
                <MenuButton
                  label="Source"
                  active={menu === "source"}
                  onClick={() => setMenu(menu === "source" ? null : "source")}
                  text={playable[sourceIndex]?.label ?? "Source"}
                  chrome={chrome}
                  panel={
                    <Panel>
                      {playable.map((entry, index) => (
                        <Option
                          key={`${entry.url}-${index}`}
                          active={index === sourceIndex}
                          onClick={() => {
                            setSourceIndex(index);
                            setAttempt(0);
                            setMenu(null);
                          }}
                        >
                          {entry.label} {entry.quality ? `· ${entry.quality}` : ""}
                          {entry.codec === "hevc" ? " · HDR/HEVC" : ""}
                        </Option>
                      ))}
                    </Panel>
                  }
                />
              )}

              {/* captions */}
              {captionTracks.length > 0 && (
                <MenuButton
                  icon={<SubtitlesIcon width={17} height={17} />}
                  label="Captions"
                  active={menu === "captions"}
                  onClick={() => setMenu(menu === "captions" ? null : "captions")}
                  chrome={chrome}
                  panel={
                    <Panel>
                      <Option
                        active={caption === -1}
                        onClick={() => {
                          if (videoRef.current) videoRef.current.textTracks[0] && (videoRef.current.textTracks[0].mode = "disabled");
                          setCaption(-1);
                          setMenu(null);
                        }}
                      >
                        Off
                      </Option>
                      {captionTracks.map((track) => (
                        <Option
                          key={track.index}
                          active={caption === track.index}
                          onClick={() => {
                            setCaption(track.index);
                            setMenu(null);
                          }}
                        >
                          {track.label}
                        </Option>
                      ))}
                    </Panel>
                  }
                />
              )}

              {/* quality */}
              {levels.length > 1 && (
                <MenuButton
                  label="Quality"
                  active={menu === "quality"}
                  onClick={() => setMenu(menu === "quality" ? null : "quality")}
                  text={level >= 0 ? levels.find((entry) => entry.index === level)?.label ?? "Auto" : "Auto"}
                  chrome={chrome}
                  panel={
                    <Panel>
                      <Option
                        active={level === -1}
                        onClick={() => {
                          if (hlsRef.current) hlsRef.current.currentLevel = -1;
                          setLevel(-1);
                          setMenu(null);
                        }}
                      >
                        Auto
                      </Option>
                      {[...levels].reverse().map((entry) => (
                        <Option
                          key={entry.index}
                          active={level === entry.index}
                          onClick={() => {
                            setLevel(entry.index);
                            setMenu(null);
                          }}
                        >
                          {entry.label}
                        </Option>
                      ))}
                    </Panel>
                  }
                />
              )}

              {/* audio track */}
              {audioTracks.length > 1 && (
                <MenuButton
                  label="Audio"
                  active={menu === "audio"}
                  onClick={() => setMenu(menu === "audio" ? null : "audio")}
                  text={audioTracks.find((entry) => entry.index === audio)?.label ?? "Audio"}
                  chrome={chrome}
                  panel={
                    <Panel>
                      {audioTracks.map((track) => (
                        <Option
                          key={track.index}
                          active={audio === track.index}
                          onClick={() => {
                            setAudio(track.index);
                            setMenu(null);
                          }}
                        >
                          {track.label}
                        </Option>
                      ))}
                    </Panel>
                  }
                />
              )}

              {/* playback speed */}
              <MenuButton
                label="Playback speed"
                active={menu === "speed"}
                onClick={() => setMenu(menu === "speed" ? null : "speed")}
                text={speed === 1 ? "1x" : `${speed}x`}
                chrome={chrome}
                panel={
                  <Panel>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => (
                      <Option
                        key={value}
                        active={speed === value}
                        onClick={() => {
                          setSpeed(value);
                          setMenu(null);
                        }}
                      >
                        {value === 1 ? "Normal" : `${value}x`}
                      </Option>
                    ))}
                  </Panel>
                }
              />

              <button type="button" onClick={() => void togglePip()} aria-label="Picture in picture" className="hidden p-1.5 text-white/85 hover:text-white sm:block">
                <PiPIcon />
              </button>
              <button type="button" onClick={toggleFullscreen} aria-label="Fullscreen" className="p-1.5 text-white/85 hover:text-white">
                <FullscreenIcon width={17} height={17} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* title chip */}
      <div className={cn("pointer-events-none absolute left-4 top-3 z-30 transition-opacity", chrome ? "opacity-100" : "opacity-0")}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--nf-accent)]">NOFLIX Player</p>
        <p className="max-w-[60vw] truncate text-[13px] font-semibold text-white/90">{title}</p>
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-11 right-0 z-40 max-h-[46vh] w-[210px] overflow-y-auto overscroll-contain rounded-lg border border-white/10 bg-[#141414]/[0.98] p-1 shadow-2xl backdrop-blur-xl">
      {children}
    </div>
  );
}

function Option({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition hover:bg-white/10",
        active ? "text-white" : "text-white/70",
      )}
    >
      <span className="truncate">{children}</span>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--nf-accent)]" />}
    </button>
  );
}

function MenuButton({
  label,
  text,
  icon,
  active,
  onClick,
  panel,
}: {
  label: string;
  text?: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
  panel: React.ReactNode;
  chrome?: boolean;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          "flex items-center gap-1 rounded px-1.5 py-1 text-[11.5px] font-medium transition",
          active ? "bg-white/20 text-white" : "text-white/80 hover:text-white",
        )}
      >
        {icon ?? text ?? label}
        <ChevronDownIcon width={11} height={11} />
      </button>
      {active && panel}
    </div>
  );
}

function PiPIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <rect x="12" y="12" width="7" height="5" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
