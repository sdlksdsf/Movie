import { titles } from "@/data/titles";
import { generatedArt } from "@/data/generated";
import type { Genre, Season, Title } from "@/lib/types";
import { allowedFor } from "@/lib/avatars";

export const allTitles = titles;

/** Genres that are safe for a kids profile. */
const KIDS_GENRES: Genre[] = ["Family", "Animation", "Comedy", "Adventure", "Fantasy"];

export function isKidsSafe(title: Title) {
  if (title.genres.includes("Horror") || title.genres.includes("Crime")) return false;
  if (!title.genres.some((g) => KIDS_GENRES.includes(g))) return false;
  return !["18+", "TV-MA", "R"].includes(title.maturity);
}

/** Everything a profile may see — kids and maturity levels in one place. */
export function visibleFor(
  title: Title,
  profile?: { kids?: boolean; maturity?: string } | null,
  hideMature = false,
) {
  if (profile?.kids) return isKidsSafe(title);
  const level = (profile?.maturity ?? "all") as "kids" | "7" | "13" | "16" | "all";
  if (level === "all") return !hideMature || !["18+", "TV-MA", "R", "NC-17"].includes(title.maturity);
  return allowedFor(level, title.maturity);
}

export function animeTitles() {
  return titles.filter((t) => t.anime);
}

const bySlug = new Map(titles.map((t) => [t.slug, t]));

export function getTitle(slug: string): Title | undefined {
  return bySlug.get(slug);
}

export function posterSrc(slug: string) {
  return generatedArt[slug]?.poster ?? `/img/posters/${slug}.webp`;
}

export function backdropSrc(slug: string) {
  return generatedArt[slug]?.backdrop ?? `/img/backdrops/${slug}.webp`;
}

export function formatRuntime(minutes?: number) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "2 Seasons" / "Film" / "1h 48m" — the compact meta line under a title. */
export function shortMeta(t: Title) {
  if (t.kind === "movie") return formatRuntime(t.runtime);
  return t.seasons === 1 ? "Limited Series" : `${t.seasons} Seasons`;
}

export const genres: Genre[] = Array.from(
  new Set(titles.flatMap((t) => t.genres)),
).sort() as Genre[];

export function genreSlug(genre: string) {
  return genre.toLowerCase().replace(/\s+/g, "-");
}

export function genreFromSlug(slug: string): Genre | undefined {
  return genres.find((g) => genreSlug(g) === slug);
}

export function byGenre(genre: Genre) {
  return titles.filter((t) => t.genres.includes(genre));
}

export function featuredTitles() {
  return titles.filter((t) => t.featured);
}

/**
 * The billboard rotation: a mix of what's hot right now rather than the same
 * single hand-picked title. Guarantees films, series and anime all appear.
 */
export function heroTitles(limit = 9): Title[] {
  const score = (t: Title) => {
    const fresh = t.year >= 2025 ? 26 : t.year >= 2023 ? 14 : 0;
    const badge = t.badge ? 10 : 0;
    return t.rating * 7 + t.match / 5 + fresh + badge + (t.featured === true ? 18 : 0);
  };

  const pool = [...titles].sort((a, b) => score(b) - score(a));
  const picked: Title[] = [];
  const take = (predicate: (t: Title) => boolean, count: number) => {
    let added = 0;
    for (const title of pool) {
      if (added >= count) break;
      if (picked.some((p) => p.slug === title.slug)) continue;
      if (!predicate(title)) continue;
      picked.push(title);
      added += 1;
    }
  };

  // an even split — 3 series, 3 films, 3 anime — so the hero rotation always
  // moves through every corner of the catalogue instead of the same show
  take((t) => t.kind === "series" && !t.anime, 3);
  take((t) => t.kind === "movie" && !t.anime, 3);
  take((t) => Boolean(t.anime), 3);
  take(() => true, limit);

  return picked.slice(0, limit);
}

export function topTen() {
  return titles
    .filter((t) => typeof t.top10 === "number")
    .sort((a, b) => (a.top10 ?? 99) - (b.top10 ?? 99))
    .slice(0, 10);
}

/** Relative-similarity scoring: genre overlap, kind, era, rating. */
export function similarTo(title: Title, limit = 9) {
  return titles
    .filter((t) => t.slug !== title.slug)
    .map((t) => {
      let score = t.genres.filter((g) => title.genres.includes(g)).length * 12;
      if (t.kind === title.kind) score += 3;
      score += Math.max(0, 8 - Math.abs(t.year - title.year) / 4);
      score += t.rating;
      return { t, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.t);
}

export function searchTitles(query: string, limit = 40) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  return titles
    .map((t) => {
      const haystack = [
        t.name,
        t.creator,
        t.cast.join(" "),
        t.genres.join(" "),
        t.year.toString(),
        t.tagline,
        t.overview,
      ]
        .join(" ")
        .toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (!haystack.includes(term)) return { t, score: -1 };
        if (t.name.toLowerCase().startsWith(term)) score += 10;
        else if (t.name.toLowerCase().includes(term)) score += 6;
        else if (t.genres.join(" ").toLowerCase().includes(term)) score += 3;
        else score += 1;
      }
      score += t.rating / 2;
      return { t, score };
    })
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.t);
}

/* ------------------------------------------------------------------ *
 * Episodes — deterministic, generated so the detail modal & player
 * always have a believable season/episode structure to render.
 * ------------------------------------------------------------------ */

const episodeBeats = [
  "A familiar face returns with a warning nobody wants to hear.",
  "An old debt comes due, and the price is higher than expected.",
  "Secrets surface at exactly the wrong moment.",
  "A fragile alliance is tested and found wanting.",
  "The plan works — which is precisely the problem.",
  "Somebody has been lying, and the truth is worse than the lie.",
  "A quiet day becomes the turning point of the season.",
  "Two worlds collide in a way no one can walk back from.",
  "The past refuses to stay buried.",
  "Every choice narrows the exits, until only one remains.",
  "The clock runs out long before anyone is ready.",
  "An impossible decision is made in a single breath.",
  "Trust is offered, and immediately spent.",
  "Everything hinges on a call that never comes.",
  "Old loyalties split clean down the middle.",
  "Not everyone makes it home tonight.",
];

const episodeTitles = [
  "Cold Open",
  "The Long Way Round",
  "Static",
  "Threads",
  "No Sanctuary",
  "Fault Lines",
  "The Weight of It",
  "Crossfire",
  "Unexpected Guests",
  "Before the Fall",
  "What We Owe",
  "The Other Door",
  "Smoke and Mirrors",
  "Nine Lives",
  "The Quiet Part",
  "Paper Trails",
  "Long Night",
  "The Hand You're Dealt",
  "Terminal Velocity",
  "Broken Compass",
  "Echo Chamber",
  "The Last Exit",
  "Splinter",
  "Aftermath",
];

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function seasonsFor(title: Title): Season[] {
  const count = title.kind === "movie" ? 0 : Math.min(title.seasons ?? 1, 4);
  const seasons: Season[] = [];
  for (let s = 1; s <= count; s++) {
    const base = hash(`${title.slug}-${s}`);
    const episodeCount = 6 + (base % 4);
    /* walk the pools sequentially from a per-season offset: every episode in a
       season gets its own title and its own synopsis (a season is 6–9 episodes,
       the pools are 24 and 16, so nothing repeats) */
    const titleStart = base % episodeTitles.length;
    const beatStart = hash(`${title.slug}-beats-${s}`) % episodeBeats.length;
    const episodes = Array.from({ length: episodeCount }, (_, i) => {
      const idx = hash(`${title.slug}-${s}-${i}`);
      return {
        number: i + 1,
        name: episodeTitles[(titleStart + i) % episodeTitles.length],
        runtime: 42 + (idx % 18),
        overview: episodeBeats[(beatStart + i) % episodeBeats.length],
      };
    });
    seasons.push({
      number: s,
      year: title.year + (s - 1),
      episodes,
    });
  }
  return seasons;
}

/** Stable pseudo-random watch progress (0–1) for the continue-watching row. */
export function pseudoProgress(slug: string) {
  return 0.12 + (hash(slug) % 62) / 100;
}

export function episodeLabel(title: Title, season: number, episode: number) {
  return `S${season}:E${episode} “${
    seasonsFor(title)
      .find((s) => s.number === season)
      ?.episodes.find((e) => e.number === episode)?.name ?? "Episode"
  }”`;
}
