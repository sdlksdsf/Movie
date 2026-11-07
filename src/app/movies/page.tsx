import type { Metadata } from "next";
import { BrowseGrid } from "@/components/browse-grid";
import { allTitles } from "@/lib/catalog";

export const metadata: Metadata = { title: "Movies — NOFLIX" };

export default function Page() {
  return (
    <BrowseGrid
      titles={allTitles.filter((t) => t.kind === "movie")}
      heading="Movies"
      subheading="Big-screen favourites, award winners and the ones you keep meaning to re-watch."
    />
  );
}
