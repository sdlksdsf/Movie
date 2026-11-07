import type { Title } from "@/lib/types";

/**
 * Stream sources.
 *
 * frameXTV is the default: it starts fastest and plays both movies and series.
 * CineLite is the backup (4K + subtitles + anime via AniList ids).
 * If a title can't be served by a source we fall through to the other one.
 */

export type PlayerId = "framex" | "cinelite";

export type PlayerDef = {
  id: PlayerId;
  label: string;
  short: string;
  hint: string;
  host: string;
  /** shown next to the source in the picker */
  badge?: string;
};

export const DEFAULT_PLAYER: PlayerId = "framex";

export const PLAYERS: PlayerDef[] = [
  {
    id: "framex",
    label: "frameXTV",
    short: "XTV",
    hint: "Primary · fastest start",
    host: "https://framextv.cc",
    badge: "Default",
  },
  {
    id: "cinelite",
    label: "CineLite",
    short: "Lite",
    hint: "Backup · 4K + subtitles",
    host: "https://embed.cinelite.xyz",
  },
];

export const QUALITIES = ["4k", "1080p", "720p", "480p"] as const;
export type Quality = (typeof QUALITIES)[number];
export const DEFAULT_QUALITY: Quality = "1080p";

const ACCENT = "e50914";

export function isPlayerId(value: unknown): value is PlayerId {
  return value === "framex" || value === "cinelite";
}

export function playerMeta(id: PlayerId): PlayerDef {
  return PLAYERS.find((p) => p.id === id) ?? PLAYERS[0];
}

export function otherPlayer(id: PlayerId): PlayerId {
  return id === "framex" ? "cinelite" : "framex";
}

/** frameXTV needs a TMDB id; CineLite also accepts AniList ids alone. */
export function canPlay(id: PlayerId, title: Title): boolean {
  if (id === "framex") return Boolean(title.tmdbId);
  return Boolean(title.tmdbId || title.anilistId);
}

/** The source we can actually use right now, preferring the requested one. */
export function resolvePlayer(preferred: PlayerId, title: Title): PlayerId {
  if (canPlay(preferred, title)) return preferred;
  const other = otherPlayer(preferred);
  return canPlay(other, title) ? other : preferred;
}

export function buildSrc(o: {
  player: PlayerId;
  title: Title;
  season: number;
  episode: number;
  quality: Quality;
  resumeAt?: number | null;
}): string {
  const { player, title, season, episode, quality, resumeAt } = o;
  const resume = resumeAt && resumeAt > 20 ? Math.floor(resumeAt) : null;

  if (player === "framex") {
    // /embed/{tmdbId} for films · /embed/{tmdbId}/{s}/{e} for series + anime
    const base =
      title.kind === "series"
        ? `https://framextv.cc/embed/${title.tmdbId}/${season}/${episode}`
        : `https://framextv.cc/embed/${title.tmdbId}`;

    const params = new URLSearchParams();
    params.set("autoplay", "1");
    params.set("muted", "0");
    params.set("controls", "1");
    if (resume) params.set("t", String(resume));
    return `${base}?${params.toString()}`;
  }

  const base = title.anilistId
    ? `https://embed.cinelite.xyz/anime/${title.anilistId}/${episode}`
    : title.kind === "series"
      ? `https://embed.cinelite.xyz/tv/${title.tmdbId}/${season}/${episode}`
      : `https://embed.cinelite.xyz/${title.tmdbId}`;

  const params = new URLSearchParams();
  params.set("color", ACCENT);
  params.set("suggestionui", "false");
  params.set("quality", quality);
  params.set("autoplay", "1");
  if (resume) params.set("t", String(resume));
  const query = params.toString();
  // CineLite reads params from the query *and* the hash
  return `${base}?${query}#${query}`;
}
