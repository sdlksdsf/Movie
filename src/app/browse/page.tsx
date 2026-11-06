import type { Metadata } from "next";
import { BrowseGrid } from "@/components/browse-grid";
import { allTitles } from "@/lib/catalog";

export const metadata: Metadata = { title: "Browse All Titles — Netflix" };

export default function Page() {
  return (
    <BrowseGrid
      titles={allTitles}
      heading="Browse All Titles"
      subheading={`Every film and series in the catalogue — ${allTitles.length} titles across ${new Set(allTitles.flatMap((t) => t.genres)).size} genres.`}
    />
  );
}
