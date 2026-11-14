import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy — NOFLIX",
  description:
    "NOFLIX hosts no video files. What we do and do not store, who serves playback, and how to delete everything.",
};

export default function Page() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy policy" updated="6 November 2026">
      <p className="rounded-xl border border-white/15 bg-white/[0.04] p-4 text-[13.5px] leading-relaxed text-white/80">
        <strong className="text-white">We host nothing.</strong> NOFLIX stores no video files, no
        audio, no images and no adult media of any kind. It is an interface: posters and descriptions
        are pulled from public metadata APIs, and every frame you watch is delivered by an independent
        third-party provider straight to your browser. Nothing passes through our servers, and there
        is no upload, download, cache or media bucket behind this site.
      </p>

      <h2>What that means in practice</h2>
      <ul>
        <li>There is no media storage in this deployment — no bucket, no CDN origin, no filesystem with videos on it.</li>
        <li>Playback requests go from <em>your</em> browser to the provider. We never sit in the middle, so we cannot see what you watch, and we keep no record of it.</li>
        <li>Only metadata (titles, artwork, synopses, episode lists, ratings) is fetched by the server and cached briefly in memory.</li>
        <li>If a provider removes something, the link here stops working. We cannot restore it, because we never had a copy.</li>
      </ul>

      <h2>What we store</h2>
      <p>Everything below lives in your browser, not on a server, under <code>localStorage</code> keys beginning with <code>nf.</code>:</p>
      <ul>
        <li><strong>Profiles</strong> — the name, character, colour and maturity level you choose.</li>
        <li><strong>My List</strong> — the titles you saved.</li>
        <li><strong>Watch progress</strong> — the season, episode and position you reached.</li>
        <li><strong>Preferences</strong> — accent colour, density, server, quality, language and toggles.</li>
      </ul>
      <p>Clearing site data removes all of it completely.</p>

      <h2>Optional cloud sync</h2>
      <p>
        If the deployment is configured with a Supabase project, the same preferences are mirrored to
        a single row keyed by a random device identifier generated in your browser. That row is
        protected by row-level security, so only your device id can read or write it. There is no
        email, no name beyond the profile label you typed, and no way to link the row to a real
        person. Deleting your data (Settings → Privacy &amp; data) empties the local copy.
      </p>

      <h2>Cookies</h2>
      <p>
        NOFLIX sets no cookies at all — not for tracking, not for sessions, not for preferences.
        Everything it remembers lives in <code>localStorage</code> and stays on your device.
      </p>

      <h2>Third parties</h2>
      <ul>
        <li><strong>TMDB</strong> — metadata, artwork and trailer ids.</li>
        <li><strong>TVMaze</strong> and <strong>Jikan (MyAnimeList)</strong> — episode and anime data.</li>
        <li><strong>YouTube</strong> — trailers play in an embedded, privacy-enhanced player on first click.</li>
        <li><strong>frameXTV, CineLite, RiveStream</strong> — playback embeds for the main catalogue. Your browser loads content from them directly, so they can see your IP address and set their own storage. Their policies apply, not ours.</li>
        <li><strong>Vercel</strong> — hosting and standard request logs, retained briefly.</li>
      </ul>
      <p>
        We do not sell, share or trade anything, because there is nothing personal to sell: no
        account, no email, no advertising identifier, no profile of your viewing.
      </p>

      <h2>Your rights</h2>
      <p>
        Because the data never leaves your device unless you enable sync, you can exercise every right
        yourself: export it, edit it or delete it in <strong>Settings → Privacy &amp; data</strong>.
        What we hold is limited to what your browser stores — so clearing site data is a complete
        erasure, and there is no server-side copy to request.
      </p>

      <h2>Children</h2>
      <p>
        Kids profiles hide mature titles across every shelf, grid and search result, and nothing on
        this site is aimed at children. No personal information is requested from anyone of any age.
      </p>

      <h2>Changes</h2>
      <p>
        Material changes to this policy will be noted on this page with a new date. Questions can be
        raised as an issue on the GitHub repository.
      </p>
    </LegalPage>
  );
}
