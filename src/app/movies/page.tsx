import type { Metadata } from "next";
import { LiveCatalogue } from "@/components/live-catalogue";

export const metadata: Metadata = {
  title: "Movies — NOFLIX",
  description: "1,000 films ready to stream, popularity ordered and refreshed every few hours.",
};

export default function Page() {
  return <LiveCatalogue fixedTab="movie" heading="1,000 movies" />;
}
