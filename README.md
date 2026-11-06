# NOFLIX Clone — a full, working streaming UI

A pixel-faithful NOFLIX experience built with **Next.js 15 (App Router)**, **Tailwind CSS v4**
and **Framer Motion**. Browse, search, save, preview on hover and stream — everything in one
self-contained app.

![stack](https://img.shields.io/badge/Next.js-15-black) ![stack](https://img.shields.io/badge/React-19-blue) ![stack](https://img.shields.io/badge/Tailwind-4-38bdf8)

---

---

## 🔌 Data pipeline & public API

The catalogue is no longer a hand-maintained list. Titles flow in through a
provider layer (`src/lib/providers.ts`) and are merged with the curated set.

```
providers                used for                          key needed
------------------------ --------------------------------- ----------
TMDB                     movies + series, posters, art     TMDB_API_KEY (free)
TVMaze                   series, episodes, cast            none
Jikan (MyAnimeList)      anime                             none
IMDb suggestions         title search + poster art         none
Cinemeta (Stremio)       tmdb/imdb ids + blurbs + art      none  ← sync script
```

**Sync more titles**

```bash
npm run sync-catalog                 # merge ~120 popular titles
npm run sync-catalog -- --limit 400  # go bigger
npm run sync-catalog -- --only series
```

The script resolves a verified `moviedb_id` + `imdb_id` for every title, writes
`src/data/catalog.generated.json`, and the app merges it with the curated
`src/data/titles.ts` at build time (artwork falls back to the IMDb CDN so no
title is ever a grey box). Set `TMDB_API_KEY` in `.env.local` to unlock TMDB in
the live search and in the provider status endpoint.

**JSON API** (all cacheable, no auth)

| Route | Returns |
| --- | --- |
| `GET /api/catalog?q=&kind=&genre=&limit=&offset=` | paginated catalogue |
| `GET /api/catalog/[slug]` | full record + seasons + “More Like This” |
| `GET /api/rows` | the home-page row composition |
| `GET /api/search?q=&live=1` | local hits + live provider results |
| `GET /api/providers` | which metadata sources are active |

Anything the live providers surface can be played straight away —
`/play/{tmdbId}?title=…&kind=…` renders the player for titles that are
not in the bundled catalogue yet.

## ✨ What's inside

**Browsing**
- Animated “Who's watching?” profile gate + a NOFLIX-style *tudum* splash on entry
- Auto-rotating billboard hero with Ken Burns drift, match score, maturity badge and a
  Play / More Info / My List action row
- 15+ curated rows: Trending, Top 10 in Pakistan (giant rank numerals), NOFLIX Originals,
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
- NOFLIX-style modal: blurred key art header, cast & creator, tagline, season/episode browser,
  “More Like This” and an About block
- Deep-linkable standalone detail pages at `/title/[slug]`

**Playback**
- Full-bleed player at `/watch/[kind]/[slug]` powered by the **CineLite** embed
  (`https://embed.cinelite.xyz/{tmdbId}`, `/tv/{tmdbId}/{season}/{episode}`,
  `/anime/{anilistId}/{episode}`), themed with our brand red (`?color=e50914`),
  pause suggestions on, starting quality selectable (4K → 480p)
- Custom chrome that auto-hides: back, title, season/episode picker, server switcher,
  a server switcher (Viper / Archer), quality and subtitle-language menus, next-episode
  button and a progress rail fed by the player's real `CINELITE_PLAYBACK_PROGRESS` telemetry
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
https://embed.cinelite.xyz/157336?color=e50914&suggestionui=true&quality=1080p&t=120
// series
https://embed.cinelite.xyz/tv/259909/1/3?color=e50914&suggestionui=true&quality=1080p
```

The custom controls talk to the iframe through the documented `postMessage` SDK
(`play`, `pause`, `seek`, `seekBy`, `mute`, `setVolume`, `setProvider`, `setSubtitle`) and listen
for `CINELITE_PLAYBACK_PROGRESS` to drive the progress rail and Continue Watching.
Progress is saved both in our own store (`nf.progress`) and in the player's
`cw_{tmdbId}` key, so a resume lands on the right frame. The player's own exit
button (`CINELITE_EXIT_PLAYER`) is wired to our router, server/quality/subtitle
changes are pushed in via `CINELITE_SYNC_SETTINGS`, and anime titles carry an
AniList id so they stream through the `/anime/` route.

---

## ⚖️ Notes

This is a **learning/demo project**. All titles, metadata and artwork belong to NOFLIX and the
respective studios; posters are hot-linked from IMDb's public image CDN with local fallbacks.
Streaming is provided by third-party embed services (CineLite primary, FrameXTV fallback) — nothing is hosted here.

Built with Next.js 15, React 19, Tailwind CSS v4, Framer Motion 12, Inter + Anton (self-hosted
via Fontsource), and ImageMagick for the artwork pipeline.
