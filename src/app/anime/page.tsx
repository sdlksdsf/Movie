import type { Metadata } from "next";
import { LiveCatalogue } from "@/components/live-catalogue";
import { Navbar } from "@/components/navbar";
import { LiveRows } from "@/components/live-rows";

export const metadata: Metadata = {
  title: "Anime — NOFLIX",
  description:
    "Anime series and films, subbed and dubbed, streamed from anime-native sources.",
};

/**
 * The anime hub used to render without the site chrome at all
 * (`chrome={false}` hid the navbar, and `fixedTab` hid the film/series switcher),
 * which left the visitor with no search, no links back and no way to browse
 * anything else. It now opens on Anime but keeps the navbar, the tab switcher
 * and the audience filters.
 */
export default function Page() {
  return (
    <>
      <Navbar />
      <div className="pt-24 md:pt-28">
        <LiveRows variant="anime" />
      </div>
      <LiveCatalogue initialTab="anime" heading="Anime" chrome={false} />
    </>
  );
}
