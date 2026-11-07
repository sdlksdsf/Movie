import type { Metadata } from "next";
import { LiveCatalogue } from "@/components/live-catalogue";

export const metadata: Metadata = {
  title: "TV Shows — NOFLIX",
  description: "1,000 series ready to binge, popularity ordered and refreshed every few hours.",
};

export default function Page() {
  return <LiveCatalogue fixedTab="series" heading="1,000 TV shows" />;
}
