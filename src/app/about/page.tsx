import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "About NOFLIX — the streaming front-end",
  description:
    "NOFLIX is an open streaming front-end built with Next.js and TMDB. No accounts, no trackers, playable in any browser.",
};

export default function Page() {
  return (
    <LegalPage eyebrow="About" title="A streaming front-end, built for the browser" updated="November 2026">
      <p>
        NOFLIX is a Netflix-style viewing experience for the open web. It pulls artwork and metadata
        from <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a> and
        episodes from TVMaze and MyAnimeList, then hands playback to independent embed players.
        Nothing is re-hosted here.
      </p>

      <h2>What is inside</h2>
      <ul>
        <li><strong>Thousands of titles</strong> — a bundled catalogue for instant browsing plus a live TMDB catalogue that pages in as you scroll.</li>
        <li><strong>Profiles</strong> — twelve vector characters, your own colour, and real maturity levels. Kids profiles only ever see family-safe titles.</li>
        <li><strong>My List &amp; Continue Watching</strong> — saved per profile, on the device, optionally synced to your own Supabase project.</li>
        <li><strong>Three stream servers</strong> — frameXTV by default, CineLite as backup, RiveStream as the last resort, with automatic failover.</li>
        <li><strong>Settings that matter</strong> — accent colour, card density, motion, data saver, default server, quality and language.</li>
        <li><strong>A developer panel</strong> — live status of every API and stream server, straight from your browser.</li>
      </ul>

      <h2>How it is built</h2>
      <p>
        Next.js 15 (App Router), React 19, Tailwind CSS 4 and Framer Motion, deployed on Vercel.
        Profiles, lists and progress live in <code>localStorage</code>; when Supabase environment
        variables are present they are mirrored to a single row per device, protected by row-level
        security.
      </p>

      <h2>Try it</h2>
      <ul>
        <li><Link href="/">Open the home page</Link></li>
        <li><Link href="/browse">Browse the full catalogue</Link></li>
        <li><Link href="/settings">Open settings</Link></li>
        <li><a href="https://github.com/sdlksdsf/Movie" target="_blank" rel="noreferrer">Source on GitHub</a></li>
      </ul>

      <h2>Credits &amp; disclaimer</h2>
      <p>
        All titles, artwork, trailers and videos belong to their respective owners. This project is a
        technical demonstration of a streaming interface; it does not host, upload or store any video
        content, and it is not affiliated with Netflix or any studio. If you like something you find
        here, watch it on the service that made it.
      </p>
      <p>
        Metadata courtesy of TMDB. This product uses the TMDB API but is not endorsed or certified by
        TMDB.
      </p>
    </LegalPage>
  );
}
