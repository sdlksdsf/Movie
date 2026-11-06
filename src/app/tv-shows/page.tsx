import type { Metadata } from "next";
import { BrowseGrid } from "@/components/browse-grid";
import { allTitles } from "@/lib/catalog";

export const metadata: Metadata = { title: "TV Shows — Netflix" };

export default function Page() {
  return (
    <BrowseGrid
      titles={allTitles.filter((t) => t.kind === "series")}
      heading="TV Shows"
      subheading="Binge-ready series — from three-season thrillers to sitcoms you have already watched five times."
    />
  );
}
