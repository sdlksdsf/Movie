/**
 * Real episode stills.
 *
 * TMDB's season endpoint returns a `still_path` per episode — those are the
 * proper, episode-specific 16:9 frames Netflix shows in an episode list.
 * We resolve them in the browser, cache per (show, season) for the session and
 * silently fall back to tinted series artwork when a season has no stills.
 */

import { TMDB_API_KEY } from "@/lib/tmdb-key";

const ENDPOINT = "https://api.themoviedb.org/3";
const IMAGE = "https://image.tmdb.org/t/p/w300";
const apiKey = () => TMDB_API_KEY;

export type StillMap = Record<number, string>;

const memory = new Map<string, StillMap>();
const inflight = new Map<string, Promise<StillMap>>();

type SeasonResponse = {
  episodes?: Array<{ episode_number?: number; still_path?: string | null }>;
};

export function seasonStills(tmdbId: number, season: number): Promise<StillMap> {
  if (!tmdbId || season <= 0) return Promise.resolve({});
  const id = `${tmdbId}-${season}`;

  const hit = memory.get(id);
  if (hit) return Promise.resolve(hit);

  const running = inflight.get(id);
  if (running) return running;

  const storageKey = `nf.stills.${id}`;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as StillMap;
      memory.set(id, parsed);
      return Promise.resolve(parsed);
    }
  } catch {
    /* private mode */
  }

  const task = (async (): Promise<StillMap> => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 7000);
    try {
      const res = await fetch(`${ENDPOINT}/tv/${tmdbId}/season/${season}?api_key=${apiKey()}`, {
        signal: controller.signal,
      });
      if (!res.ok) return {};
      const json = (await res.json()) as SeasonResponse;
      const map: StillMap = {};
      for (const ep of json.episodes ?? []) {
        if (ep.episode_number && ep.still_path) map[ep.episode_number] = `${IMAGE}${ep.still_path}`;
      }
      memory.set(id, map);
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(map));
      } catch {
        /* ignore */
      }
      return map;
    } catch {
      return {};
    } finally {
      window.clearTimeout(timer);
      inflight.delete(id);
    }
  })();

  inflight.set(id, task);
  return task;
}
