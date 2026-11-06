#!/usr/bin/env node
/**
 * Turns the raw artwork collected in ./image-search into production assets.
 *
 *  • posters  -> public/img/posters/<slug>.webp    (500×750, 2:3)
 *  • backdrops-> public/img/backdrops/<slug>.webp  (1600×900, 16:9)
 *
 * Candidates are matched by filename prefix (= the slug) and scored on how
 * close their aspect ratio is to a real poster, then on resolution. A small
 * override map lets us hand-pick a specific source file when needed.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rawDir = path.join(root, "image-search");
const posterOut = path.join(root, "public/img/posters");
const backdropOut = path.join(root, "public/img/backdrops");
const cacheDir = path.join(root, ".cache/artwork");

const overrides = {
  // slug: "exact file name inside ./image-search"
  "the-queens-gambit": "the-queen-s-gambit-poster-netflix-1.jpg",
};

const slugs = fs
  .readdirSync(path.join(root, "src/data"))
  .includes("titles.ts")
  ? (fs.readFileSync(path.join(root, "src/data/titles.ts"), "utf8").match(/slug: "([^"]+)"/g) ?? []).map(
      (s) => s.replace(/slug: "|"/g, ""),
    )
  : [];

fs.mkdirSync(posterOut, { recursive: true });
fs.mkdirSync(backdropOut, { recursive: true });
fs.mkdirSync(cacheDir, { recursive: true });

const files = fs.existsSync(rawDir)
  ? fs.readdirSync(rawDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  : [];

function dimensions(file) {
  try {
    const out = execFileSync("identify", ["-format", "%w %h", path.join(rawDir, file)]).toString().trim();
    const [w, h] = out.split(/\s+/).map(Number);
    if (!w || !h) return null;
    return { w, h };
  } catch {
    return null;
  }
}

const marked = new Set();

function pick(slug, kind) {
  if (overrides[slug] && files.includes(overrides[slug])) return overrides[slug];
  const candidates = files.filter((f) => !marked.has(f) && f.startsWith(slug));
  if (!candidates.length) return null;
  const target = kind === "poster" ? 0.667 : 1.777;
  const scored = candidates
    .map((file) => {
      const dim = dimensions(file);
      if (!dim) return null;
      const ratio = dim.w / dim.h;
      const penalty = Math.abs(ratio - target);
      return { file, w: dim.w, h: dim.h, ratio, penalty, area: dim.w * dim.h };
    })
    .filter(Boolean);
  const viable = scored
    .filter((c) => (kind === "poster" ? c.ratio < 0.88 : c.ratio > 1.25))
    .sort((a, b) => a.penalty - b.penalty || b.area - a.area);
  return viable[0]?.file ?? null;
}

function render(src, dest, w, h, quality) {
  execFileSync("convert", [
    path.join(rawDir, src),
    "-auto-orient",
    "-resize",
    `${w}x${h}^`,
    "-gravity",
    "center",
    "-extent",
    `${w}x${h}`,
    "-strip",
    "-quality",
    String(quality),
    "-define",
    "webp:method=6",
    dest,
  ]);
}

const report = { posters: [], backdrops: [], missing: [] };

for (const slug of slugs) {
  const poster = pick(slug, "poster");
  if (poster) {
    marked.add(poster);
    render(poster, path.join(posterOut, `${slug}.webp`), 500, 750, 82);
    report.posters.push(slug);
  } else {
    report.missing.push(slug);
  }

  const backdrop = pick(slug, "backdrop");
  if (backdrop) {
    marked.add(backdrop);
    render(backdrop, path.join(backdropOut, `${slug}.webp`), 1600, 900, 78);
    report.backdrops.push(slug);
  }
}

console.log(`posters:   ${report.posters.length}/${slugs.length}`);
console.log(`backdrops: ${report.backdrops.length}`);
console.log(`missing posters (${report.missing.length}): ${report.missing.join(", ")}`);
