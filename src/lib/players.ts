import type { Title } from "@/lib/types";

/**
 * Stream sources, in failover order.
 *
 * frameXTV starts fastest and is the default; CineLite is the feature-rich
 * backup (4K, subtitles, anime ids); RiveStream is the last resort that keeps
 * the site playable when the first two are down. The player walks this list
 * automatically when a source stops responding.
 */

export type PlayerId = "framex" | "cinelite" | "rivestream";

export type PlayerDef = {
  id: PlayerId;
  label: string;
  short: string;
  hint: string;
  host: string;
  badge?: string;
  /** order in the failover chain */
  rank: number;
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
    rank: 0,
  },
  {
    id: "cinelite",
    label: "CineLite",
    short: "Lite",
    hint: "Backup · 4K + subtitles",
    host: "https://embed.cinelite.xyz",
    rank: 1,
  },
  {
    id: "rivestream",
    label: "RiveStream",
    short: "Rive",
    hint: "Fallback · if both are down",
    host: "https://rivestream.ru",
    rank: 2,
  },
];

export const QUALITIES = ["4k", "1080p", "720p", "480p"] as const;
export type Quality = (typeof QUALITIES)[number];
export const DEFAULT_QUALITY: Quality = "1080p";

const ACCENT = "e50914";

export function isPlayerId(value: unknown): value is PlayerId {
  return value === "framex" || value === "cinelite" || value === "rivestream";
}

export function playerMeta(id: PlayerId): PlayerDef {
  return PLAYERS.find((p) => p.id === id) ?? PLAYERS[0];
}

/** Every other source, in failover order. */
export function otherPlayers(id: PlayerId): PlayerId[] {
  return PLAYERS.filter((p) => p.id !== id)
    .sort((a, b) => a.rank - b.rank)
    .map((p) => p.id);
}

export function otherPlayer(id: PlayerId): PlayerId {
  return otherPlayers(id)[0] ?? "framex";
}

/** The next server to try after `id`, or the first one when the chain wraps. */
export function nextServer(id: PlayerId): PlayerId {
  const sorted = [...PLAYERS].sort((a, b) => a.rank - b.rank).map((p) => p.id);
  const index = sorted.indexOf(id);
  return sorted[(index + 1) % sorted.length];
}

/** Every server needs a TMDB id; CineLite can also play AniList-only anime. */
export function canPlay(id: PlayerId, title: Title): boolean {
  if (id === "cinelite") return Boolean(title.tmdbId || title.anilistId);
  return Boolean(title.tmdbId);
}

/** The source we can actually use right now, preferring the requested one. */
export function resolvePlayer(preferred: PlayerId, title: Title): PlayerId {
  if (canPlay(preferred, title)) return preferred;
  const fallback = PLAYERS.filter((p) => p.id !== preferred)
    .sort((a, b) => a.rank - b.rank)
    .map((p) => p.id)
    .find((id) => canPlay(id, title));
  return fallback ?? preferred;
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

  if (player === "rivestream") {
    // https://rivestream.ru/embed?type=movie&id={tmdbId}
    // https://rivestream.ru/embed?type=tv&id={tmdbId}&season={s}&episode={e}
    const params = new URLSearchParams();
    params.set("type", title.kind === "series" ? "tv" : "movie");
    params.set("id", String(title.tmdbId));
    if (title.kind === "series") {
      params.set("season", String(season));
      params.set("episode", String(episode));
    }
    if (resume) params.set("t", String(resume));
    return `https://rivestream.ru/embed?${params.toString()}`;
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
