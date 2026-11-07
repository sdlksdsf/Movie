import type { Metadata } from "next";
import { BrowseGrid } from "@/components/browse-grid";
import { LiveRows } from "@/components/live-rows";
import { animeTitles } from "@/lib/catalog";

export const metadata: Metadata = { title: "Anime — NOFLIX" };

export default function Page() {
  return (
    <>
      <div className="px-0 pt-24">
        <LiveRows variant="anime" />
      </div>
      <BrowseGrid
        titles={animeTitles()}
        heading="Anime in the catalogue"
        subheading="Subbed and dubbed series and films, streamed through the anime source route."
      />
    </>
  );
}
