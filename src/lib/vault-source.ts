import "server-only";
import type { VaultFeed, VaultItem } from "@/lib/vault-types";

/**
 * Where the vault's is sourced from.
 *
 * NOFLIX stores, transcodes and proxies **no** adult media. Two ways to fill
 * the vault, both of which leave playback with the provider:
 *
 *   1. `eporner` (default) — Eporner's public Webmasters API v2. Keyless,
 *      documented, and it returns an `embed_url`, so the player is an iframe
 *      pointed straight at them. Their API is the sanctioned integration path;
 *      their terms forbid scraping the site itself, which this never does.
 *
 *   2. `custom` — your own provider's JSON index via `VAULT_FEED_URL`
 *      (+ `VAULT_FEED_KEY`). Accepted payloads: a bare array,
 *      `{ items: [...] }`, `{ results: [...] }` or `{ data: { items: [...] } }`.
 *
 * Env:
 *   VAULT_PROVIDER  eporner | custom | none      (default: eporner, or custom
 *                                                when VAULT_FEED_URL is set)
 *   VAULT_QUERY     optional search term          (eporner)
 *   VAULT_ORDER     top-weekly | top-monthly | top-rated | latest (eporner)
 *   VAULT_PAGES     how many 100-item pages to pull, 1–6 (eporner, default 2)
 */

const MAX_ITEMS = 240;
const TIMEOUT_MS = 9000;
const EPORNER_SEARCH = "https://www.eporner.com/api/v2/video/search/";
const EPORNER_EMBED = "https://www.eporner.com/embed/";

/* ------------------------------------------------------------------ helpers */

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** only http(s) — a `javascript:` URL in a feed must never become a src */
function safeUrl(value: unknown): string | undefined {
  const raw = str(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** tags arrive as strings, or as `{ name }` / `{ id, name }` objects */
function normaliseTags(value: unknown, fallback?: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : typeof fallback === "string"
        ? fallback.split(",")
        : [];
  const names = raw
    .map((entry) => {
      if (typeof entry === "string") return entry.trim().toLowerCase();
      if (entry && typeof entry === "object") {
        const box = entry as Record<string, unknown>;
        return str(box.name ?? box.title ?? box.label).toLowerCase();
      }
      return "";
    })
    .filter(Boolean);
  return [...new Set(names)].slice(0, 8);
}

/* ------------------------------------------------------------ generic feed */

function pickList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const box = payload as Record<string, unknown>;
    for (const key of ["items", "results", "videos", "data"]) {
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

function normaliseItem(raw: unknown, index: number, provider: string): VaultItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const embed = safeUrl(item.embed ?? item.embedUrl ?? item.embed_url ?? item.iframe);
  const stream = safeUrl(item.stream ?? item.url ?? item.hls ?? item.src ?? item.playback);
  const title = str(item.title ?? item.name);
  if (!title || (!embed && !stream)) return null;
  return {
    id: str(item.id ?? item.slug ?? item.key) || `vault-${index}`,
    title: title.slice(0, 160),
    year: Number.isFinite(Number(item.year)) && Number(item.year) > 1800 ? Number(item.year) : undefined,
    duration: str(item.duration ?? item.runtime) || undefined,
    tags: normaliseTags(item.tags ?? item.categories ?? item.genres, item.keywords),
    poster: safeUrl(item.poster ?? item.thumbnail ?? item.image)?.slice(0, 600),
    embed,
    stream,
    rating: str(item.rating) || "18+",
    source: provider,
  };
}

async function loadCustomFeed(): Promise<VaultFeed> {
  const endpoint = process.env.VAULT_FEED_URL;
  if (!endpoint) return { items: [], configured: false, provider: "none" };

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
    if (!res.ok) return { items: [], configured: true, provider: "custom", error: `feed responded ${res.status}` };
    const payload = (await res.json()) as unknown;
    const items = pickList(payload)
      .slice(0, MAX_ITEMS)
      .map((entry, index) => normaliseItem(entry, index, "custom"))
      .filter((entry): entry is VaultItem => entry !== null);
    return { items, total: items.length, configured: true, provider: "custom" };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "feed timed out" : "feed unreachable";
    return { items: [], configured: true, provider: "custom", error: message };
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------- eporner v2 */

function epornerUrl(page: number): string {
  const params = new URLSearchParams({
    per_page: "100",
    page: String(page),
    thumbsize: "big",
    order: process.env.VAULT_ORDER?.trim() || "top-weekly",
    format: "json",
  });
  const query = process.env.VAULT_QUERY?.trim();
  if (query) params.set("query", query);
  return `${EPORNER_SEARCH}?${params.toString()}`;
}

/** Webmasters API v2 shape → our shape. Unknown fields are simply ignored. */
function fromEporner(raw: unknown): VaultItem | null {
  if (!raw || typeof raw !== "object") return null;
  const video = raw as Record<string, unknown>;
  const id = str(video.id);
  const title = str(video.title);
  if (!id || !title) return null;

  const thumb = video.default_thumb as Record<string, unknown> | undefined;
  const thumbs = Array.isArray(video.thumbs) ? video.thumbs : [];
  const firstThumb = thumbs[0] as Record<string, unknown> | undefined;
  /* the Webmasters API hands back `length_min` already formatted mm:ss, and
     `length_sec` as a raw count — use the formatted one, fall back to maths */
  const seconds = Number(video.length_sec);
  const duration =
    str(video.length_min) ||
    (Number.isFinite(seconds) && seconds > 0
      ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`
      : undefined);

  return {
    id,
    title: title.slice(0, 160),
    duration,
    tags: normaliseTags(video.tags ?? video.categories, video.keywords),
    poster: safeUrl(thumb?.src ?? firstThumb?.src)?.slice(0, 600),
    embed: safeUrl(video.embed) ?? safeUrl(video.embed_url) ?? `${EPORNER_EMBED}${encodeURIComponent(id)}/`,
    rating: "18+",
    source: "eporner",
  };
}

async function loadEporner(): Promise<VaultFeed> {
  const pages = clamp(Number(process.env.VAULT_PAGES ?? 2) || 2, 1, 6);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const responses = await Promise.allSettled(
      Array.from({ length: pages }, async (_, index) => {
        const res = await fetch(epornerUrl(index + 1), {
          signal: controller.signal,
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(`eporner responded ${res.status}`);
        return (await res.json()) as unknown;
      }),
    );

    const seen = new Set<string>();
    const items: VaultItem[] = [];
    let failure: string | undefined;

    for (const response of responses) {
      if (response.status === "rejected") {
        const reason = response.reason instanceof Error ? response.reason.message : "";
        /* keep the real status code, but never surface a raw stack message */
        failure = /responded \d{3}/.test(reason) ? reason : "provider unreachable";
        continue;
      }
      for (const row of pickList(response.value)) {
        const item = fromEporner(row);
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
        if (items.length >= MAX_ITEMS) break;
      }
      if (items.length >= MAX_ITEMS) break;
    }

    if (items.length === 0 && failure) {
      return { items: [], configured: true, provider: "eporner", error: failure };
    }
    return { items, total: items.length, configured: true, provider: "eporner" };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "provider timed out" : "provider unreachable";
    return { items: [], configured: true, provider: "eporner", error: message };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------- dispatch */

export function vaultProvider(): "eporner" | "custom" | "none" {
  const explicit = (process.env.VAULT_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "none" || explicit === "off") return "none";
  if (explicit === "custom") return "custom";
  if (explicit === "eporner") return "eporner";
  if (process.env.VAULT_FEED_URL) return "custom";
  /* zero-config default: the vault works as soon as a PIN exists */
  return "eporner";
}

export async function loadVaultFeed(): Promise<VaultFeed> {
  const provider = vaultProvider();
  if (provider === "none") return { items: [], configured: false, provider: "none" };
  return provider === "custom" ? loadCustomFeed() : loadEporner();
}
