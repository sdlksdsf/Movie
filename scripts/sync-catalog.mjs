#!/usr/bin/env node
/**
 * Catalogue sync pipeline.
 *
 * Pulls live metadata (title, year, genres, blurb, cast, runtime, IMDb id and —
 * crucially — the TMDB id the frameXTV player needs) from the Cinemeta provider
 * and merges it into `src/data/catalog.generated.json`.
 *
 *   npm run sync-catalog              # merge ~120 popular titles
 *   npm run sync-catalog -- --limit 400
 *   npm run sync-catalog -- --only series
 *
 * Entries already in the file (including hand-written ones) are never removed,
 * so re-running is safe. Needs network access; the shipped JSON was produced
 * with this exact script.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "src/data/catalog.generated.json");
const PROVIDER = "https://v3-cinemeta.strem.io";

const args = process.argv.slice(2);
const limit = Number(args[args.indexOf("--limit") + 1]) || 120;
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : "all";

const FEEDS = [
  { type: "movie", path: "/catalog/movie/top.json" },
  { type: "series", path: "/catalog/series/top.json" },
  { type: "movie", path: "/catalog/movie/top/genre=Action.json" },
  { type: "movie", path: "/catalog/movie/top/genre=Comedy.json" },
  { type: "movie", path: "/catalog/movie/top/genre=Horror.json" },
  { type: "movie", path: "/catalog/movie/top/genre=Animation.json" },
  { type: "series", path: "/catalog/series/top/genre=Drama.json" },
  { type: "series", path: "/catalog/series/top/genre=Anime.json" },
].filter((feed) => only === "all" || feed.type === only);

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);

async function fetchFeed(feed) {
  try {
    const res = await fetch(`${PROVIDER}${feed.path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.metas ?? []).map((meta) => normalize(meta, feed.type)).filter(Boolean);
  } catch (error) {
    console.warn(`skip ${feed.path}: ${error.message}`);
    return [];
  }
}

function normalize(meta, fallbackKind) {
  const tmdbId = Number(meta.moviedb_id ?? meta.moviedbId);
  const imdbId = meta.imdb_id ?? meta.id;
  if (!tmdbId || !imdbId?.startsWith("tt") || !meta.name) return null;
  if (/^untitled/i.test(meta.name)) return null;

  const kind = (meta.type === "series" ? "series" : fallbackKind) ?? "movie";
  const runtime = Number(String(meta.runtime ?? "").match(/\d+/)?.[0]) || undefined;
  const year = Number(String(meta.year ?? meta.releaseInfo ?? "").slice(0, 4)) || undefined;

  return {
    slug: slugify(meta.name),
    tmdbId,
    imdbId,
    kind,
    name: meta.name,
    year: year ?? new Date().getFullYear(),
    runtime: kind === "movie" ? runtime : undefined,
    seasons: kind === "series" ? 1 : undefined,
    genres: meta.genres ?? meta.genre ?? [],
    rating: Number(meta.imdbRating) || 7.4,
    overview: meta.description ?? "",
    creator: meta.director?.[0] ?? meta.writer?.[0] ?? "Netflix",
    cast: (meta.cast ?? []).slice(0, 4),
    featured: false,
  };
}

const existing = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) : [];
const byTmdb = new Map(existing.map((entry) => [entry.tmdbId, entry]));
const usedSlugs = new Set(existing.map((entry) => entry.slug));

let added = 0;
for (const feed of FEEDS) {
  if (byTmdb.size >= existing.length + limit) break;
  const items = await fetchFeed(feed);
  for (const item of items) {
    if (!item || byTmdb.has(item.tmdbId)) continue;
    let slug = item.slug;
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${item.slug}-${n++}`;
    item.slug = slug;
    usedSlugs.add(slug);
    byTmdb.set(item.tmdbId, item);
    added += 1;
    if (added >= limit) break;
  }
}

const merged = [...byTmdb.values()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
await writeFile(OUT, `${JSON.stringify(merged, null, 2)}\n`);
console.log(`catalog.generated.json → ${merged.length} titles (+${added} this run)`);
