"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
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
  /** when known, art is resolved from TMDB by id — the most dependable source */
  tmdbId?: number;
};

/**
 * Artwork with a graceful fallback ladder so the grid is never empty:
 *   poster   → REMOTE poster → local optimised webp → gradient plate
 *   backdrop → local wide still → REMOTE still → local poster → gradient plate
 *
 * Two rules keep this honest:
 *   1. every remote URL goes through `/api/img`, so the browser never talks to
 *      a third-party CDN that might be blocked, slow or silently hanging — the
 *      proxy's timeout turns a hung host into an `onError` we can act on;
 *   2. an <img> is visible from the first paint. It used to be opacity-0 until
 *      a client-side `onLoad` flipped a React state, which meant any hydration
 *      problem or stalled request left the whole site looking image-less.
 */
export function Artwork({
  slug,
  name,
  kind = "poster",
  accent = "#333",
  priority = false,
  className,
  sizes,
  tmdbId,
}: ArtworkProps) {
  const sources = useMemo(() => {
    const remote = remotePoster(slug);
    const byTmdb = tmdbId ? `/api/img?tmdb=${tmdbId}&kind=${kind}` : null;
    const list: string[] = [];

    if (kind === "backdrop") {
      if (localBackdrops.has(slug)) list.push(backdropSrc(slug));
      if (byTmdb) list.push(byTmdb);
      if (remote) list.push(remote);
      if (localPosters.has(slug)) list.push(posterSrc(slug));
      if (!list.length) list.push(backdropSrc(slug), posterSrc(slug));
      return list;
    }

    if (byTmdb) list.push(byTmdb);
    if (remote) list.push(remote);
    if (localPosters.has(slug)) list.push(posterSrc(slug));
    if (!list.length) list.push(posterSrc(slug));
    return list;
  }, [slug, kind, tmdbId]);

  const [index, setIndex] = useState(0);
  const raw = sources[Math.min(index, sources.length - 1)];
  /* local /img/… paths are already ours; only remote art needs the proxy */
  const src = /^https?:\/\//i.test(raw) ? `/api/img?u=${encodeURIComponent(raw)}` : raw;

  const failed = index >= sources.length;

  return (
    <span className={cn("relative block h-full w-full overflow-hidden bg-[#1a1a1a]", className)}>
      {/* colour wash under the art — visible while it loads, never "black hole" */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 30% 15%, ${accent}66 0%, #101010 60%, #050505 100%)`,
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
          /* no client state decides whether the art is visible */
          onError={() => setIndex((i) => i + 1)}
          className="object-cover object-center opacity-100"
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
