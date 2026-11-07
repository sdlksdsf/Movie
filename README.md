# NOFLIX

**A Netflix-style streaming front-end for the open web.** Thousands of films, series and anime;
customisable profiles with real kids restrictions; five stream servers with automatic failover
(including two anime-native sources);
and a settings screen that actually changes the product.

[![Live demo](https://img.shields.io/badge/live-noflix--taupe.vercel.app-e50914?style=for-the-badge)](https://noflix-taupe.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-087ea4?style=for-the-badge&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)

![NOFLIX](https://noflix-taupe.vercel.app/opengraph-image)

> **Live site → [noflix-taupe.vercel.app](https://noflix-taupe.vercel.app)**

---

## Table of contents

- [What it does](#what-it-does)
- [Screens](#screens)
- [Profiles and kids mode](#profiles-and-kids-mode)
- [Stream servers and failover](#stream-servers-and-failover)
- [Settings](#settings)
- [Architecture](#architecture)
- [Run it locally](#run-it-locally)
- [Deploy it yourself](#deploy-it-yourself)
- [Privacy and legal](#privacy-and-legal)
- [Credits](#credits)

---

## What it does

| | |
|---|---|
| **Catalogue** | A bundled catalogue for instant first paint, plus a live TMDB catalogue that pages in as you scroll — thousands of films, series and anime, deduped and cached. |
| **Hero billboard** | Rotating feature banners with muted trailer previews, match score, maturity badge and one-tap play. |
| **Dense shelves** | 20+ rows per page, 20–26 titles each, all derived from the catalogue — no hand-written slug lists that go stale. |
| **Search** | Instant local search across the bundled catalogue, extended with live TMDB results. |
| **My List & Continue Watching** | Per profile, accurate to the episode and second, with resume positions passed into the player. |
| **Profiles** | Twelve hand-drawn vector characters, any accent colour, five maturity levels, per-profile autoplay. |
| **Kids mode** | A separate green space where only animation, family and pre-school titles exist — shelves, grids and search all filtered. |
| **Settings** | Accent colour, card density, motion, hover previews, data saver, default server, quality, language, privacy, developer tools. |
| **Developer panel** | Live status and latency for every API and stream server, straight from the browser, plus repository stars and build info. |
| **Legal** | Real About, Privacy, Terms and Copyright/DMCA pages — no lorem ipsum. |

## Screens

The site is live; these open the real thing:

| Screen | Live |
|---|---|
| Home / billboard | [/](https://noflix-taupe.vercel.app/) |
| Live catalogue browser | [/browse](https://noflix-taupe.vercel.app/browse) |
| Anime | [/anime](https://noflix-taupe.vercel.app/anime) |
| My List | [/my-list](https://noflix-taupe.vercel.app/my-list) |
| Settings | [/settings](https://noflix-taupe.vercel.app/settings) |
| Developer status | [/settings?tab=developer](https://noflix-taupe.vercel.app/settings?tab=developer) |
| About | [/about](https://noflix-taupe.vercel.app/about) |

## Profiles and kids mode

Profiles are stored per device and are fully customisable:

- **Character** — 12 vector avatars (robot, astronaut, panda, fox, hero, cat, alien, dragon,
  unicorn, bear, ninja, cinema). Drawn as SVG, so they stay sharp everywhere and weigh nothing.
- **Colour** — 12 presets plus a full colour picker; the same accent tints the avatar and, if you
  want, the whole site.
- **Maturity** — `Little kids · 7+ · 13+ · 16+ · All`, enforced across shelves, grids, search,
  My List and live rows.
- **Kids profile** — sets a softer green theme and hides horror, crime, war and adult-flagged
  titles everywhere. Kids rows are limited to animation, family and pre-school genres.

## Stream servers and failover

Playback is delegated to third-party embeds. NOFLIX walks the list automatically when a server
does not respond, so a dead provider never leaves you on a black screen:

Films and series resolve against TMDB ids, anime resolves against AniList ids, so every title
starts on a server that actually knows it:

```
Films & series:  frameXTV (default) → VidFast (4K) → VidLink (subs) → CineLite → RiveStream
Anime:           VidNest (sub/dub) → AniEmbed (sub/dub) → VidFast → VidLink → frameXTV
```

The chain only moves on when a frame genuinely fails to load (18s with no `load` event). Playback
telemetry is *not* used as a liveness signal: most embeds never `postMessage`, and treating silence
as failure used to bounce a healthy stream through every provider. If a specific source stalls,
**Player menu → Next server**, or **Open in new tab**, always gets you out.

Anime titles are matched to their AniList id from the catalogue, the AniList GraphQL API, or the
AniList relational id map (ARM), then played with the chosen audio track (sub or dub). Each server can be
selected manually in the player menu or set as the default in **Settings → Playback**. If a title
has no source on the chosen server, the next one is picked automatically.

## Settings

`/settings` ships seven panels:

1. **Profiles** — edit name, character, colour, maturity, autoplay; switch or delete profiles.
2. **Appearance** — accent colour (live), card density, reduce motion, hover previews, data saver.
3. **Playback** — default server, quality, language, anime audio (sub/dub), autoplay next episode.
4. **Privacy & data** — mature-title filter, export your data as JSON, delete everything.
5. **Developer** — service health with latency, repository stats, build and runtime info.
6. **About & legal** — links to the About, Privacy, Terms and DMCA pages.

## Architecture

```
app/                      routes (home, browse, anime, movies, tv-shows, my-list, title, play, settings, legal)
components/               UI  (billboard, shelves, player, profiles, settings, developer panel)
lib/
  catalog.ts              bundled catalogue + visibility rules (kids / maturity)
  discover.ts             live TMDB catalogue paging (films, series, anime)
  live.ts                 TMDB shelves, Jikan anime, TVMaze
  players.ts              three embed providers + failover chain + URL builders
  trailer.ts              TMDB trailers with a Cinemeta backstop, ranked candidates
  cloud.ts                optional Supabase mirror (RLS, per-device row)
data/                     bundled titles and artwork maps
```

- **Framework** Next.js 15 App Router · React 19 · TypeScript
- **Styling** Tailwind CSS 4 with CSS variables for theming
- **Motion** Framer Motion, opt-out via *Reduce motion*
- **Hosting** Vercel · **Optional database** Supabase (Postgres + row-level security)

Performance choices: lazy-mounted shelves (`IntersectionObserver`), `content-visibility` on rows,
lazy/async artwork, skeletons instead of empty boxes, preconnected image hosts, and a data-saver
mode that drops blur and heavy motion on slow connections.

## Run it locally

```bash
git clone https://github.com/sdlksdsf/Movie.git
cd Movie
npm install
npm run dev     # http://localhost:3000
```

Optional environment variables (all client-safe, none required to run):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_TMDB_KEY` | Overrides the TMDB key used for metadata and trailers |
| `NEXT_PUBLIC_SUPABASE_URL` | Turns on cloud sync |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonymous (RLS-protected) key for that project |

## Deploy it yourself

1. Import the repository into Vercel — it is a stock Next.js app, no build tweaks needed.
2. (Optional) create a Supabase project and run:

```sql
create table if not exists public.app_state (
  device_id  text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

create policy "read own device state" on public.app_state for select
  using (device_id = coalesce(current_setting('request.headers', true)::json ->> 'x-device-id', ''));

create policy "insert own device state" on public.app_state for insert
  with check (device_id = coalesce(current_setting('request.headers', true)::json ->> 'x-device-id', ''));

create policy "update own device state" on public.app_state for update
  using (device_id = coalesce(current_setting('request.headers', true)::json ->> 'x-device-id', ''))
  with check (device_id = coalesce(current_setting('request.headers', true)::json ->> 'x-device-id', ''));
```

3. Add the two Supabase variables to the Vercel project and redeploy. Sync is optional — without
   it the app is fully functional and entirely local.

## Privacy and legal

- No accounts, no passwords, no analytics, no advertising trackers, no cookies.
- Profiles, My List and progress live in `localStorage`; cloud sync is optional and one row per
  device, protected by row-level security.
- Full text: [Privacy](https://noflix-taupe.vercel.app/privacy) ·
  [Terms](https://noflix-taupe.vercel.app/terms) ·
  [Copyright & DMCA](https://noflix-taupe.vercel.app/dmca) ·
  [About](https://noflix-taupe.vercel.app/about)

## Credits

Metadata, artwork and trailer identifiers come from **TMDB**; episode data from **TVMaze**; anime
data from **Jikan (MyAnimeList)**. Trailers play in a privacy-enhanced YouTube embed. Video is
served by independent third-party embed providers — this project does not host, upload or store any
video content.

This product uses the TMDB API but is not endorsed or certified by TMDB. Not affiliated with
Netflix or any studio. All titles and artwork belong to their respective owners.

## Licence

Released under the MIT licence — see [LICENSE](./LICENSE).
