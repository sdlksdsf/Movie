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
        <li><strong>Vault unlock preference</strong> — a yes/no flag (<code>nf.adult</code>) remembering whether you turned the 18+ shelf on. It is not the PIN.</li>
      </ul>
      <p>Clearing site data removes all of it completely.</p>

      <h2>The 18+ vault</h2>
      <p>
        The vault is an adults-only section that is hidden from every profile except one set to{" "}
        <strong>All</strong> maturity. It is gated by a PIN known only to the site owner, kept in a
        httpOnly session cookie for 45 minutes, and revoked immediately on any other profile. It
        stores no watch history, no favourites and nothing in <code>localStorage</code> beyond the
        on/off flag above.
      </p>
      <p>
        The vault hosts no media either. It renders the provider&apos;s own player in an iframe —{" "}
        <strong>Eporner</strong> by default, or whichever provider this deployment is configured with.
        That provider sees your IP address, may set its own cookies and applies its own terms. We do
        not proxy, mirror, download or re-encode anything, and we receive no analytics from it.
      </p>

      <h2>Optional cloud sync</h2>
      <p>
        If the deployment is configured with a Supabase project, the same preferences are mirrored to
        a single row keyed by a random device identifier generated in your browser. That row is
        protected by row-level security, so only your device id can read or write it. There is no
        email, no name beyond the profile label you typed, and no way to link the row to a real
        person. Deleting your data (Settings → Privacy &amp; data) empties the local copy. Vault
        unlock flags and maturity choices are included in that row; nothing about what you watched
        in the vault is ever synced, because nothing about it is recorded in the first place.
      </p>

      <h2>Cookies</h2>
      <p>
        NOFLIX sets exactly one cookie, and only if you use the vault:{" "}
        <code>nf_vault</code> — httpOnly, SameSite=Lax, 45-minute lifetime, containing nothing but a
        signed expiry timestamp. It is created when you enter the PIN correctly and deleted when you
        press <em>Lock</em>, when the timer runs out, or when a non-adult profile opens the vault.
        Nothing else on this site sets a cookie, and there are no trackers, analytics scripts,
        advertising pixels or third-party beacons.
      </p>

      <h2>Third parties</h2>
      <ul>
        <li><strong>TMDB</strong> — metadata, artwork and trailer ids.</li>
        <li><strong>TVMaze</strong> and <strong>Jikan (MyAnimeList)</strong> — episode and anime data.</li>
        <li><strong>YouTube</strong> — trailers play in an embedded, privacy-enhanced player on first click.</li>
        <li><strong>frameXTV, CineLite, RiveStream</strong> — playback embeds for the main catalogue. Your browser loads content from them directly, so they can see your IP address and set their own storage. Their policies apply, not ours.</li>
        <li><strong>Your vault provider</strong> (Eporner by default) — serves the adult content in the 18+ section, from their own player, on their own terms.</li>
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
        Kids profiles hide mature titles across every shelf, grid and search result. The 18+ vault is
        not rendered, linked or reachable for kids, 7+, 13+ or 16+ profiles — the entry point does not
        exist in their interface, the path returns a 404, and any session opened on an adult profile
        is destroyed the moment a non-adult profile opens it. No personal information is requested
        from anyone of any age.
      </p>

      <h2>Changes</h2>
      <p>
        Material changes to this policy will be noted on this page with a new date. Questions can be
        raised as an issue on the GitHub repository.
      </p>
    </LegalPage>
  );
}
