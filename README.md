# Netflix Clone — a full, working streaming UI

A pixel-faithful Netflix experience built with **Next.js 15 (App Router)**, **Tailwind CSS v4**
and **Framer Motion**. Browse, search, save, preview on hover and stream — everything in one
self-contained app.

![stack](https://img.shields.io/badge/Next.js-15-black) ![stack](https://img.shields.io/badge/React-19-blue) ![stack](https://img.shields.io/badge/Tailwind-4-38bdf8)

---

## ✨ What's inside

**Browsing**
- Animated “Who's watching?” profile gate + a Netflix-style *tudum* splash on entry
- Auto-rotating billboard hero with Ken Burns drift, match score, maturity badge and a
  Play / More Info / My List action row
- 15+ curated rows: Trending, Top 10 in Pakistan (giant rank numerals), Netflix Originals,
  Continue Watching (with real progress bars), Because-you-watched, genres, New Releases…
- Poster cards that lift on hover, with a **floating preview panel** (play, add to list, like,
  match %, genres) rendered in a portal so it never gets clipped by the row scroller
- Smooth, momentum-friendly horizontal rows with edge-aware arrows and snap scrolling
- Reveal-on-scroll animations, lazy artwork, blur-up placeholders, `prefers-reduced-motion`
  support

**Discovery**
- Instant search overlay (`/` or `⌘K` anywhere) — searches titles, cast, genres and year
- Genre landing pages (`/genre/action`, …) with filter + sort chips
- Dedicated TV Shows / Movies / New & Popular / Browse All / My List pages

**Title detail**
- Netflix-style modal: blurred key art header, cast & creator, tagline, season/episode browser,
  “More Like This” and an About block
- Deep-linkable standalone detail pages at `/title/[slug]`

**Playback**
- Full-bleed player at `/watch/[kind]/[slug]` powered by the **frameXTV** embed
  (`https://framextv.xyz/embed/{tmdbId}[/{season}/{episode}]`)
- Custom chrome that auto-hides: back, title, season/episode picker, server switcher,
  subtitles, mute, fullscreen, seek bar driven by real `frameXTV:timeupdate` telemetry
- Keyboard shortcuts — `Space` play/pause, `←`/`→` ±10s, `M` mute, `F` fullscreen,
  `N` next episode, `Esc` exit
- Watch progress is written back into **Continue Watching** (localStorage)

**Persistence** — profile, My List and playback progress live in `localStorage`; no account,
no backend.

---

## 🚀 Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

Other scripts:

```bash
npm run typecheck        # tsc --noEmit
npm run images           # rebuild optimised artwork from ./image-search
```

---

## 🗂 Project structure

```
src/
  app/                 routes (App Router)
    page.tsx           home / browse
    watch/[kind]/[slug]  the player
    title/[slug]       deep-link detail page
    genre/[slug] tv-shows movies new-popular browse my-list
    globals.css        design tokens, utilities, keyframes
  components/          UI (billboard, row, title-modal, player, navbar, …)
  data/
    titles.ts          the catalogue (52 titles, hand-written copy)
    rows.ts            row definitions
    artwork.ts         generated poster/backdrop manifests
  lib/
    catalog.ts         lookups, search, similarity, episode generation
scripts/
  artwork-urls.json    IMDb artwork ids per title
  prepare-images.mjs   crops + converts raw art into public/img/**/*.webp
public/img/
  posters/ backdrops/  optimised local artwork
```

### Adding a title

1. Append an entry to `src/data/titles.ts` (`slug`, `tmdbId`, copy, genres, accent…).
   The `tmdbId` is what the player uses, so playback works immediately.
2. Drop artwork in `public/img/posters/<slug>.webp` (2:3) and/or
   `public/img/backdrops/<slug>.webp` (16:9), **or** add the IMDb id to
   `scripts/artwork-urls.json` and run `npm run images`.
3. Add the slug to one or more rows in `src/data/rows.ts`.

Artwork resolves through a fallback ladder: IMDb CDN → local WebP → a generated
typographic plate — so the grid always looks intentional, even offline.

---

## 🎬 Player integration

The embed is appended without touching playback internals:

```ts
// movies
https://framextv.xyz/embed/550?autoplay=1&muted=0&controls=1
// series
https://framextv.xyz/embed/1399/1/3?autoplay=1&muted=0&controls=1
```

The custom controls talk to the iframe through the documented `postMessage` SDK
(`play`, `pause`, `seek`, `seekBy`, `mute`, `setVolume`, `setProvider`, `setSubtitle`) and listen
for `frameXTV:timeupdate` to drive the scrubber and Continue Watching.

---

## ⚖️ Notes

This is a **learning/demo project**. All titles, metadata and artwork belong to Netflix and the
respective studios; posters are hot-linked from IMDb's public image CDN with local fallbacks.
Streaming is provided by the third-party frameXTV service — nothing is hosted here.

Built with Next.js 15, React 19, Tailwind CSS v4, Framer Motion 12, Inter + Anton (self-hosted
via Fontsource), and ImageMagick for the artwork pipeline.
