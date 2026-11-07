import type { Metadata } from "next";
import { LiveCatalogue } from "@/components/live-catalogue";
import { allTitles } from "@/lib/catalog";

export const metadata: Metadata = { title: "Browse the full catalogue — NOFLIX" };

export default function Page() {
  return (
    <>
      <LiveCatalogue />
      <noscript>
        <p className="px-4 pb-10 text-center text-sm text-white/60">
          {allTitles.length} titles are in the bundled catalogue; enable JavaScript to browse the
          live library.
        </p>
      </noscript>
    </>
  );
}
