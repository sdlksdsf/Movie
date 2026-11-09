"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Artwork } from "@/components/artwork";
import { seasonStills } from "@/lib/stills";
import { cn } from "@/lib/cn";

/**
 * The 16:9 frame for one episode.
 *
 * Priority: the show's real TMDB still for that exact episode → the series
 * backdrop, cropped/tinted differently per episode (so a season's list never
 * looks like the same picture pasted seven times).
 */
export function EpisodeStill({
  tmdbId,
  season,
  episode,
  slug,
  accent = "#333",
  sizes = "160px",
  className,
  still: known,
}: {
  tmdbId?: number;
  season: number;
  episode: number;
  slug: string;
  accent?: string;
  sizes?: string;
  className?: string;
  /** real still already in hand (server-rendered seasons) — skips the lookup */
  still?: string;
}) {
  const [still, setStill] = useState<string | null>(known ?? null);

  useEffect(() => {
    if (!tmdbId || known) return;
    let alive = true;
    void seasonStills(tmdbId, season).then((map) => {
      if (alive) setStill(map[episode] ?? null);
    });
    return () => {
      alive = false;
    };
  }, [tmdbId, season, episode, known]);

  /* deterministic variation for the no-still fallback */
  const hue = (episode * 47 + season * 23) % 360;
  const zoom = 1.06 + ((episode * 13) % 5) * 0.05;
  const posX = 22 + ((episode * 29) % 56);
  const posY = 26 + ((episode * 17) % 46);

  return (
    <span className={cn("relative block h-full w-full overflow-hidden bg-[#1a1a1a]", className)}>
      {still ? (
        <Image
          src={still}
          alt=""
          fill
          unoptimized
          sizes={sizes}
          className="object-cover object-center"
          onError={() => setStill(null)}
        />
      ) : (
        <span
          className="absolute inset-0 block"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: `${posX}% ${posY}%`,
            filter: `hue-rotate(${hue}deg) saturate(1.12) brightness(${0.88 + (episode % 3) * 0.06})`,
          }}
        >
          <Artwork slug={slug} name="" kind="backdrop" accent={accent} sizes={sizes} />
        </span>
      )}
    </span>
  );
}
