import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Copyright & DMCA — NOFLIX",
  description: "How to report copyrighted material referenced by NOFLIX.",
};

export default function Page() {
  return (
    <LegalPage eyebrow="Legal" title="Copyright & takedown" updated="6 November 2026">
      <p>
        NOFLIX does not host video files. Everything playable is served by independent third-party
        embed providers; NOFLIX only links to them and displays metadata from public APIs.
      </p>

      <h2>Reporting a problem</h2>
      <p>
        If a title page links to content you own and you want the link removed, open an issue on the
        repository with:
      </p>
      <ul>
        <li>the title and the URL on this site,</li>
        <li>the specific material you own,</li>
        <li>your contact details and a statement that you are authorised to act for the rights holder.</li>
      </ul>
      <p>
        Valid requests are actioned by removing the entry from the catalogue or the affected embed
        provider. Requests aimed at the hosting provider should also be sent to that provider directly
        — see the stream server listed in the player for each title.
      </p>

      <h2>Metadata</h2>
      <p>
        Artwork, synopses and trailer identifiers come from TMDB, TVMaze and MyAnimeList. Corrections or
        removals at the source are reflected the next time the catalogue refreshes.
      </p>

      <h2>Good faith</h2>
      <p>
        Knowingly filing a false claim may expose you to liability. When in doubt, contact the rights
        holder or the embed provider first.
      </p>
    </LegalPage>
  );
}
