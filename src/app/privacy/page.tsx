import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy — NOFLIX",
  description: "What NOFLIX stores, where it is stored, and how to delete it.",
};

export default function Page() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy policy" updated="7 November 2026">
      <p>
        NOFLIX is built to know as little about you as possible. There are no accounts, no passwords,
        no analytics scripts, no advertising pixels and no cross-site trackers.
      </p>

      <h2>What we store</h2>
      <ul>
        <li><strong>Profiles</strong> — the name, character, colour and maturity level you choose.</li>
        <li><strong>My List</strong> — the titles you saved.</li>
        <li><strong>Watch progress</strong> — the season, episode and position you reached.</li>
        <li><strong>Preferences</strong> — accent colour, density, server, quality, language and toggles.</li>
      </ul>
      <p>
        All of this lives in your browser&apos;s <code>localStorage</code> under keys beginning with{" "}
        <code>nf.</code>. Clearing site data removes it completely.
      </p>

      <h2>Optional cloud sync</h2>
      <p>
        If the deployment is configured with a Supabase project, the same data is mirrored to a single
        row keyed by a random device identifier generated in your browser. That row is protected by
        row-level security, so only your device id can read or write it. There is no email, no name
        beyond the profile label you typed, and no way to link the row to a real person. You can turn
        sync off by using a deployment without Supabase credentials, and deleting your data (Settings →
        Privacy &amp; data) empties the local copy.
      </p>

      <h2>Cookies</h2>
      <p>
        NOFLIX sets no cookies. The only persistent storage is <code>localStorage</code> for the
        preferences above.
      </p>

      <h2>Third parties</h2>
      <ul>
        <li><strong>TMDB</strong> — metadata, artwork and trailer ids.</li>
        <li><strong>TVMaze</strong> and <strong>Jikan (MyAnimeList)</strong> — episode and anime data.</li>
        <li><strong>YouTube</strong> — trailers play in an embedded, privacy-enhanced player on first click.</li>
        <li><strong>frameXTV, CineLite, RiveStream</strong> — playback embeds. When you press play your browser loads content from them directly, so they can see your IP address and set their own storage. Their policies apply, not ours.</li>
        <li><strong>Vercel</strong> — hosting and standard request logs (removed after a short retention period).</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Because the data never leaves your device unless you enable sync, you can exercise every right
        yourself: export it, edit it or delete it in <strong>Settings → Privacy &amp; data</strong>. If
        you believe a synced row still exists, clear site data and it will be overwritten with an empty
        state on your next visit.
      </p>

      <h2>Children</h2>
      <p>
        Kids profiles hide mature titles across every shelf, grid and search result, and no personal
        information is requested from anyone of any age.
      </p>

      <h2>Changes</h2>
      <p>
        Material changes to this policy will be noted on this page with a new date. Questions can be
        raised as an issue on the GitHub repository.
      </p>
    </LegalPage>
  );
}
