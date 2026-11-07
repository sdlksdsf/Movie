import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of use — NOFLIX",
  description: "The rules for using NOFLIX, the streaming front-end demo.",
};

export default function Page() {
  return (
    <LegalPage eyebrow="Legal" title="Terms of use" updated="7 November 2026">
      <p>
        By using NOFLIX you agree to these terms. If you do not agree, please close the tab — nothing
        is stored until you create a profile.
      </p>

      <h2>What NOFLIX is</h2>
      <p>
        NOFLIX is a non-commercial interface demonstration. It indexes publicly available metadata and
        embeds players operated by third parties. It does not host, upload, transcode or distribute any
        audio-visual content.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not use the site to break the law in your jurisdiction.</li>
        <li>Do not attempt to overload, scrape abusively or attack the service or its providers.</li>
        <li>Do not use kids profiles to bypass maturity settings.</li>
        <li>Do not redistribute the site as your own product.</li>
      </ul>

      <h2>No warranty</h2>
      <p>
        The service is provided &ldquo;as is&rdquo;. Stream servers are third-party and can go down,
        change domains or stop working without notice; NOFLIX tries alternative servers automatically
        but cannot guarantee availability, quality or subtitles.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, the maintainers are not liable for any loss arising
        from use of the site, including content provided by third-party embeds.
      </p>

      <h2>Intellectual property</h2>
      <p>
        Titles, artwork, trailers and video belong to their owners. NOFLIX and its interface code are
        released under the licence in the repository. See the copyright page for takedown information.
      </p>

      <h2>Changes</h2>
      <p>These terms may be updated; the date above always reflects the current version.</p>
    </LegalPage>
  );
}
