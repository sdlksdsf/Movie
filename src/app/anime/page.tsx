import type { Metadata } from "next";
import { LiveCatalogue } from "@/components/live-catalogue";
import { LiveRows } from "@/components/live-rows";

export const metadata: Metadata = {
  title: "Anime — NOFLIX",
  description: "1,000 anime series and films, subbed and dubbed, streamed from anime-native sources.",
};

export default function Page() {
  return (
    <>
      <div className="px-0">
        <LiveRows variant="anime" />
      </div>
      <LiveCatalogue fixedTab="anime" heading="1,000 anime" chrome={false} />
    </>
  );
}
