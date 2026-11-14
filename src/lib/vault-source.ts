import "server-only";
import type { VaultFeed, VaultItem } from "@/lib/vault-types";

/**
 * Where the vault's films actually come from.
 *
 * NOFLIX ships **no** adult media and never proxies video bytes — the feed is
 * an index your provider hands you (JSON), and playback happens straight from
 * that provider's signed URLs. Set:
 *
 *   VAULT_FEED_URL   https://provider.example/api/feed      (required)
 *   VAULT_FEED_KEY   bearer token, if the feed wants one    (optional)
 *
 * Accepted payloads: a bare array, `{ items: [...] }`, `{ results: [...] }` or
 * `{ data: { items: [...] } }`. Each entry needs at least `id`, `title` and a
 * playable `stream`; everything else is optional. Anything that fails to
 * normalise is dropped rather than rendered half-broken.
 */

const MAX_ITEMS = 240;
const TIMEOUT_MS = 8000;

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown): number | undefined => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 1800 ? Math.trunc(n) : undefined;
};

/** `.m3u8` / `.mp4` only — a javascript: or file: URL in a feed is a bug. */
function safeStream(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function safeImage(value: unknown): string | undefined {
  const raw = str(value);
  return safeStream(raw) ?? undefined;
}

function tags(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(list.map((entry) => str(entry).toLowerCase()).filter(Boolean))].slice(0, 6);
}

function normalise(raw: unknown, index: number): VaultItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const stream = safeStream(item.stream ?? item.url ?? item.hls ?? item.src ?? item.playback);
  const title = str(item.title ?? item.name);
  if (!stream || !title) return null;
  return {
    id: str(item.id ?? item.slug ?? item.key) || `vault-${index}`,
    title: title.slice(0, 160),
    year: num(item.year),
    duration: str(item.duration ?? item.runtime) || undefined,
    tags: tags(item.tags ?? item.categories ?? item.genres),
    poster: safeImage(item.poster ?? item.thumbnail ?? item.image)?.slice(0, 600),
    preview: safeImage(item.preview ?? item.teaser)?.slice(0, 600),
    stream,
    rating: str(item.rating) || "18+",
  };
}

function pickList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const box = payload as Record<string, unknown>;
    for (const key of ["items", "results", "data", "videos"]) {
      const value = box[key];
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") {
        const nested = (value as Record<string, unknown>).items ?? (value as Record<string, unknown>).results;
        if (Array.isArray(nested)) return nested;
      }
    }
  }
  return [];
}

export async function loadVaultFeed(): Promise<VaultFeed> {
  const endpoint = process.env.VAULT_FEED_URL;
  if (!endpoint) return { items: [], configured: false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        accept: "application/json",
        ...(process.env.VAULT_FEED_KEY ? { authorization: `Bearer ${process.env.VAULT_FEED_KEY}` } : {}),
      },
    });
    if (!res.ok) return { items: [], configured: true, error: `feed responded ${res.status}` };
    const payload = (await res.json()) as unknown;
    const items = pickList(payload)
      .slice(0, MAX_ITEMS)
      .map(normalise)
      .filter((entry): entry is VaultItem => entry !== null);
    return { items, total: items.length, configured: true };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "feed timed out" : "feed unreachable";
    return { items: [], configured: true, error: message };
  } finally {
    clearTimeout(timer);
  }
}
