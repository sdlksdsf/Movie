import type { Metadata } from "next";
import { BrowseGrid } from "@/components/browse-grid";
import { allTitles, topTen } from "@/lib/catalog";

export const metadata: Metadata = { title: "New & Popular — NOFLIX" };

export default function Page() {
  const ranked = topTen();
  const rest = allTitles
    .filter((t) => !ranked.some((r) => r.slug === t.slug))
    .sort((a, b) => b.year - a.year);

  return (
    <BrowseGrid
      titles={[...ranked, ...rest]}
      heading="New & Popular"
      subheading="The top 10 in your region today, plus everything that just landed on the service."
    />
  );
}
