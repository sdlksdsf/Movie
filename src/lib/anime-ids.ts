/**
 * AniList id resolution.
 *
 * Anime servers (VidNest, AniEmbed, CineLite's anime route) speak AniList ids,
 * while our bundled catalogue and TMDB know titles by TMDB id or by name. This
 * module turns "Attack on Titan, 2013" into `16498` once per session:
 *
 *   1. an AniList id we already have (live rows carry one)
 *   2. a MyAnimeList id → ARM mapping service
 *   3. an AniList GraphQL title search (exact-ish match wins)
 *   4. Jikan (MyAnimeList) search → ARM mapping
 *
 * Everything is cached in memory and in sessionStorage, so switching episodes
 * or sources never re-resolves.
 */

const ARM = "https://arm.haglund.dev/api/v2/ids";
const ANILIST = "https://graphql.anilist.co";
const JIKAN = "https://api.jikan.moe/v4";

const memory = new Map<string, number | null>();

export type AnimeRef = {
  name: string;
  year?: number;
  anilistId?: number;
  malId?: number;
  tmdbId?: number;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

function cacheKey(ref: AnimeRef) {
  return `${normalize(ref.name)}|${ref.year ?? ""}|${ref.malId ?? ""}`;
}

async function getJson(url: string, init?: RequestInit): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

async function fromMal(malId: number): Promise<number | null> {
  const data = (await getJson(`${ARM}?source=myanimelist&id=${malId}&include=anilist`)) as
    | { anilist?: number }
    | null;
  return typeof data?.anilist === "number" ? data.anilist : null;
}

type AniListMedia = {
  id: number;
  title?: { romaji?: string; english?: string; native?: string };
  startDate?: { year?: number };
};

async function searchAniList(name: string, year?: number): Promise<number | null> {
  const query = `
    query ($search: String) {
      Page(perPage: 8) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id
          title { romaji english native }
          startDate { year }
        }
      }
    }`;

  const data = (await getJson(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { search: name } }),
  })) as { data?: { Page?: { media?: AniListMedia[] } } } | null;

  const media = data?.data?.Page?.media ?? [];
  if (!media.length) return null;

  const target = normalize(name);
  const scored = media.map((entry) => {
    const titles = [entry.title?.romaji, entry.title?.english, entry.title?.native]
      .filter((value): value is string => Boolean(value))
      .map(normalize);

    let score = 0;
    if (titles.some((title) => title === target)) score += 60;
    else if (titles.some((title) => title.startsWith(target) || target.startsWith(title))) score += 34;
    else if (titles.some((title) => title.includes(target) || target.includes(title))) score += 18;

    if (year && entry.startDate?.year) {
      const gap = Math.abs(entry.startDate.year - year);
      if (gap === 0) score += 20;
      else if (gap <= 1) score += 10;
      else if (gap > 4) score -= 10;
    }
    return { id: entry.id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0] && scored[0].score >= 18 ? scored[0].id : null;
}

async function searchJikan(name: string): Promise<number | null> {
  const data = (await getJson(`${JIKAN}/anime?q=${encodeURIComponent(name)}&limit=3&sfw`)) as
    | { data?: Array<{ mal_id?: number }> }
    | null;
  const malId = data?.data?.[0]?.mal_id;
  return typeof malId === "number" ? malId : null;
}

/** Best-effort AniList id for an anime title, or null. Cached per session. */
export async function anilistIdFor(ref: AnimeRef): Promise<number | null> {
  if (ref.anilistId && ref.anilistId > 0) return ref.anilistId;

  const key = cacheKey(ref);
  if (memory.has(key)) return memory.get(key) ?? null;

  let stored: string | null = null;
  try {
    stored = window.sessionStorage.getItem(`nf.anilist.${key}`);
  } catch {
    /* private mode */
  }
  if (stored !== null) {
    const value = stored ? Number(stored) : null;
    const resolved = value && Number.isFinite(value) ? value : null;
    memory.set(key, resolved);
    return resolved;
  }

  let resolved: number | null = null;

  if (ref.malId) resolved = await fromMal(ref.malId);
  if (!resolved) resolved = await searchAniList(ref.name, ref.year);
  if (!resolved) {
    const malId = await searchJikan(ref.name);
    if (malId) resolved = await fromMal(malId);
  }

  memory.set(key, resolved);
  try {
    window.sessionStorage.setItem(`nf.anilist.${key}`, resolved ? String(resolved) : "");
  } catch {
    /* ignore */
  }
  return resolved;
}
