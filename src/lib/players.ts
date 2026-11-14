import type { Title } from "@/lib/types";

/**
 * Stream sources.
 *
 * Movies and series ride the TMDB-id servers; anime has its own, because the
 * TMDB-id servers either refuse anime or serve the wrong episode numbering.
 * Anime servers speak AniList ids, which `anime-ids.ts` resolves when a title
 * only knows its name.
 *
 *   Films & series    frameXTV → VidLink → VidFast → VixSrc → CineLite
 *                     → VidSpark → EmbedWave → RiveStream
 *   Anime             VidNest → AniEmbed → frameXTV → VidLink → VidFast → VixSrc
 *
 * Every chain mixes independent providers, so one dead host never takes a
 * title down. The player only walks the chain when a frame genuinely fails to
 * load — never because a provider doesn't broadcast playback telemetry.
 */

export type PlayerId =
  | "framex"
  | "vidlink"
  | "vidfast"
  | "vixsrc"
  | "cinelite"
  | "vidspark"
  | "embedwave"
  | "rivestream"
  | "vidnest"
  | "aniembed";

export type AudioTrack = "sub" | "dub";

export type PlayerDef = {
  id: PlayerId;
  label: string;
  short: string;
  hint: string;
  host: string;
  badge?: string;
  /** ordering hint inside each chain */
  rank: number;
  /** true for the anime-native servers */
  animeOnly?: boolean;
};

export const DEFAULT_PLAYER: PlayerId = "framex";

export const PLAYERS: PlayerDef[] = [
  {
    id: "framex",
    label: "frameXTV",
    short: "XTV",
    hint: "Primary for films & series · fastest start",
    host: "https://framextv.cc",
    badge: "Default",
    rank: 0,
  },
  {
    id: "vidlink",
    label: "VidLink",
    short: "Link",
    hint: "Backup · 1080p, 13 subtitle tracks",
    host: "https://vidlink.pro",
    rank: 1,
  },
  {
    id: "vidfast",
    label: "VidFast",
    short: "Fast",
    hint: "Fast start · 4K, 8 internal sources",
    host: "https://vidfast.vc",
    rank: 2,
  },
  {
    id: "vixsrc",
    label: "VixSrc",
    short: "Vix",
    hint: "Backup · HLS, subtitles, 720p",
    host: "https://vixsrc.to",
    rank: 3,
  },
  {
    id: "cinelite",
    label: "CineLite",
    short: "Lite",
    hint: "Backup · 4K + subtitles",
    host: "https://embed.cinelite.xyz",
    rank: 4,
  },
  {
    id: "vidspark",
    label: "VidSpark",
    short: "Spark",
    hint: "Backup · auto-resume, multi-server",
    host: "https://vidspark.to",
    rank: 5,
  },
  {
    id: "embedwave",
    label: "EmbedWave",
    short: "Wave",
    hint: "Backup · multi HD, no key",
    host: "https://embedwave.cc",
    rank: 6,
  },
  {
    id: "rivestream",
    label: "RiveStream",
    short: "Rive",
    hint: "Fallback · if the others are down",
    host: "https://rivestream.ru",
    rank: 7,
  },
  {
    id: "vidnest",
    label: "VidNest",
    short: "Nest",
    hint: "Anime specialist · 1080p, sub & dub",
    host: "https://vidnest.fun",
    badge: "Anime",
    rank: 8,
    animeOnly: true,
  },
  {
    id: "aniembed",
    label: "AniEmbed",
    short: "Ani",
    hint: "Anime backup · skip intro & ending",
    host: "https://aniembed.se",
    rank: 9,
    animeOnly: true,
  },
];

export const QUALITIES = ["4k", "1080p", "720p", "480p"] as const;
export type Quality = (typeof QUALITIES)[number];
export const DEFAULT_QUALITY: Quality = "1080p";

const ACCENT = "e50914";

export function isPlayerId(value: unknown): value is PlayerId {
  return PLAYERS.some((player) => player.id === value);
}

export function playerMeta(id: PlayerId): PlayerDef {
  return PLAYERS.find((p) => p.id === id) ?? PLAYERS[0];
}

/** Is this an anime title (so it should start on an anime server)? */
export function isAnimeTitle(title: Title) {
  return Boolean(title.anime || title.anilistId);
}

/**
 * The failover chain for a title, best first.
 * Anime never starts on a TMDB-id server: they either 404 or give the wrong
 * episode, which is exactly the bug this ordering fixes.
 */
export function playOrder(title: Title): PlayerId[] {
  return isAnimeTitle(title)
    ? ["vidnest", "aniembed", "framex", "vidlink", "vidfast", "vixsrc"]
    : ["framex", "vidlink", "vidfast", "vixsrc", "cinelite", "vidspark", "embedwave", "rivestream"];
}

/** Every other server, in chain order. */
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

/**
 * Can this server play this title? `anilistId` is the id resolved at runtime
 * for anime that only knew their name.
 */
export function canPlay(id: PlayerId, title: Title, anilistId?: number | null): boolean {
  const ani = anilistId ?? title.anilistId ?? 0;
  if (id === "aniembed") return Boolean(ani);
  if (id === "vidnest" || id === "cinelite") return Boolean(ani || title.tmdbId);
  /* vidfast / vidlink / framex / rivestream / vixsrc / vidspark / embedwave
     all need a TMDB id */
  return Boolean(title.tmdbId);
}

/** The source we can actually use right now, preferring the requested one. */
export function resolvePlayer(
  preferred: PlayerId,
  title: Title,
  anilistId?: number | null,
): PlayerId {
  if (canPlay(preferred, title, anilistId)) return preferred;
  const order = playOrder(title);
  return order.find((id) => id !== preferred && canPlay(id, title, anilistId)) ?? preferred;
}

export function buildSrc(o: {
  player: PlayerId;
  title: Title;
  season: number;
  episode: number;
  quality: Quality;
  resumeAt?: number | null;
  /** resolved AniList id for anime that arrived without one */
  anilistId?: number | null;
  /** sub or dub preference for the anime servers */
  audio?: AudioTrack;
}): string {
  const { player, title, season, episode, quality, resumeAt, audio = "sub" } = o;
  const resume = resumeAt && resumeAt > 20 ? Math.floor(resumeAt) : null;
  const ani = o.anilistId ?? title.anilistId ?? 0;
  const anime = isAnimeTitle(title);

  if (player === "vidnest") {
    // https://vidnest.fun/anime/{anilistId}/{episode}/{sub|dub}
    // https://vidnest.fun/tv/{tmdbId}/{season}/{episode} · /movie/{tmdbId}
    if (anime && ani) {
      const base = `https://vidnest.fun/anime/${ani}/${Math.max(1, episode)}/${audio}`;
      return resume ? `${base}?t=${resume}` : base;
    }
    if (title.kind === "series") {
      return `https://vidnest.fun/tv/${title.tmdbId}/${season}/${episode}`;
    }
    return `https://vidnest.fun/movie/${title.tmdbId}`;
  }

  if (player === "aniembed") {
    // https://aniembed.se/e/{anilistId}/{episode}?lang=sub|dub
    const params = new URLSearchParams({ lang: audio, autoplay: "1" });
    if (resume) params.set("t", String(resume));
    return `https://aniembed.se/e/${ani}/${Math.max(1, episode)}?${params.toString()}`;
  }

  if (player === "vidfast") {
    // https://vidfast.vc/movie/{tmdbId} · /tv/{tmdbId}/{s}/{e}
    const base =
      title.kind === "series"
        ? `https://vidfast.vc/tv/${title.tmdbId}/${season}/${episode}`
        : `https://vidfast.vc/movie/${title.tmdbId}`;
    const params = new URLSearchParams({ autoPlay: "true", theme: ACCENT });
    if (title.kind === "series") params.set("nextButton", "true");
    if (resume) params.set("startAt", String(resume));
    return `${base}?${params.toString()}`;
  }

  if (player === "vidlink") {
    // https://vidlink.pro/movie/{tmdbId} · /tv/{tmdbId}/{s}/{e}
    const base =
      title.kind === "series"
        ? `https://vidlink.pro/tv/${title.tmdbId}/${season}/${episode}`
        : `https://vidlink.pro/movie/${title.tmdbId}`;
    const params = new URLSearchParams({ autoplay: "true", primaryColor: ACCENT });
    if (title.kind === "series") params.set("nextbutton", "true");
    if (resume) params.set("startAt", String(resume));
    return `${base}?${params.toString()}`;
  }

  if (player === "vixsrc") {
    // https://vixsrc.to/movie/{tmdbId} · /tv/{tmdbId}/{s}/{e}
    const base =
      title.kind === "series"
        ? `https://vixsrc.to/tv/${title.tmdbId}/${season}/${episode}`
        : `https://vixsrc.to/movie/${title.tmdbId}`;
    const params = new URLSearchParams({ color: ACCENT, autoplay: "true" });
    if (resume) params.set("t", String(resume));
    return `${base}?${params.toString()}`;
  }

  if (player === "vidspark") {
    // https://vidspark.to/movie/{tmdbId} · /tv/{tmdbId}/{s}/{e}
    const base =
      title.kind === "series"
        ? `https://vidspark.to/tv/${title.tmdbId}/${season}/${episode}`
        : `https://vidspark.to/movie/${title.tmdbId}`;
    const params = new URLSearchParams({ autoplay: "true", color: ACCENT });
    if (resume) params.set("t", String(resume));
    return `${base}?${params.toString()}`;
  }

  if (player === "embedwave") {
    // https://embedwave.cc/embed/movie/{tmdbId} · /embed/tv/{tmdbId}/{s}/{e}
    const base =
      title.kind === "series"
        ? `https://embedwave.cc/embed/tv/${title.tmdbId}/${season}/${episode}`
        : `https://embedwave.cc/embed/movie/${title.tmdbId}`;
    const params = new URLSearchParams({ autoplay: "1", color: ACCENT });
    if (resume) params.set("t", String(resume));
    return `${base}?${params.toString()}`;
  }

  if (player === "framex") {
    // /embed/{tmdbId} for films · /embed/{tmdbId}/{s}/{e} for series
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

  const base =
    anime && ani
      ? `https://embed.cinelite.xyz/anime/${ani}/${episode}`
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
