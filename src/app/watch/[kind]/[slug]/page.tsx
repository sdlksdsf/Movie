import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Player } from "@/components/player";
import { allTitles, getTitle, seasonsFor } from "@/lib/catalog";

export function generateStaticParams() {
  return allTitles.map((t) => ({ kind: t.kind, slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = getTitle(slug);
  return { title: title ? `${title.name} — NOFLIX` : "NOFLIX" };
}

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; slug: string }>;
  searchParams: Promise<{ s?: string; e?: string }>;
}) {
  const { slug } = await params;
  const { s, e } = await searchParams;
  const title = getTitle(slug);
  if (!title) notFound();

  const seasons = seasonsFor(title);
  const season = Math.min(Math.max(Number(s) || 1, 1), Math.max(seasons.length, 1));
  const episodeCount = seasons.find((x) => x.number === season)?.episodes.length ?? 1;
  const episode = Math.min(Math.max(Number(e) || 1, 1), episodeCount);

  return <Player title={title} initialSeason={season} initialEpisode={episode} seasons={seasons} />;
}
