"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { hasRemotePoster, localBackdrops, localPosters, remotePoster } from "@/data/artwork";
import { backdropSrc, posterSrc } from "@/lib/catalog";
import { cn } from "@/lib/cn";

type ArtworkProps = {
  slug: string;
  name: string;
  kind?: "poster" | "backdrop";
  accent?: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
};

/**
 * Artwork with a graceful fallback ladder so the grid is never empty:
 *   poster   → IMDb CDN 500px poster → local optimised webp → gradient plate
 *   backdrop → local wide still → IMDb poster → local poster → gradient plate
 */
export function Artwork({
  slug,
  name,
  kind = "poster",
  accent = "#333",
  priority = false,
  className,
  sizes,
}: ArtworkProps) {
  const sources = useMemo(() => {
    const remote = remotePoster(slug);
    const list: string[] = [];

    if (kind === "backdrop") {
      if (localBackdrops.has(slug)) list.push(backdropSrc(slug));
      if (remote) list.push(remote);
      if (localPosters.has(slug)) list.push(posterSrc(slug));
      if (!list.length) list.push(backdropSrc(slug), posterSrc(slug));
      return list;
    }

    if (remote) list.push(remote);
    if (localPosters.has(slug)) list.push(posterSrc(slug));
    if (!list.length) list.push(posterSrc(slug));
    return list;
  }, [slug, kind]);

  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);
  const src = sources[Math.min(index, sources.length - 1)];

  useEffect(() => {
    setIndex(0);
    setLoaded(false);
  }, [slug, kind]);

  /**
   * Images that finish loading *before* React hydrates never fire `onLoad`,
   * which used to leave banner/poster art stuck at opacity 0. Sweep for any
   * already-decoded <img> once mounted (and again after paint) to be safe.
   */
  useEffect(() => {
    const check = () => {
      const img = holder.current?.querySelector("img");
      if (img && img.complete && img.naturalWidth > 0) setLoaded(true);
    };
    check();
    const raf = window.requestAnimationFrame(check);
    const timer = window.setTimeout(check, 400);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [src]);

  const failed = index >= sources.length;

  return (
    <span ref={holder} className={cn("relative block h-full w-full overflow-hidden bg-[#1a1a1a]", className)}>
      {/* colour wash placeholder — avoids a black flash while the art loads */}
      <span
        aria-hidden
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background: `radial-gradient(120% 90% at 30% 15%, ${accent}66 0%, #101010 60%, #050505 100%)`,
          opacity: loaded ? 0 : 1,
        }}
      />

      {!failed && (
        <Image
          key={src}
          src={src}
          alt={name}
          fill
          unoptimized
          sizes={sizes ?? "(max-width: 768px) 45vw, 220px"}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          onLoad={() => setLoaded(true)}
          onError={() => setIndex((i) => i + 1)}
          className={cn(
            "object-cover object-center transition-opacity duration-500",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      {failed && (
        <span
          className="absolute inset-0 flex flex-col justify-between p-3"
          style={{
            background: `radial-gradient(130% 100% at 20% 0%, ${accent}66 0%, #0c0c0c 58%, #050505 100%)`,
          }}
        >
          <span className="text-[8.5px] font-semibold uppercase tracking-[0.28em] text-white/45">
            {hasRemotePoster(slug) ? "NOFLIX" : "Artwork"}
          </span>
          <span className="font-display text-[15px] leading-[1.05] tracking-wide text-white/90 [text-wrap:balance]">
            {name}
          </span>
        </span>
      )}
    </span>
  );
}
