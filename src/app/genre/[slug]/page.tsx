import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseGrid } from "@/components/browse-grid";
import { byGenre, genreFromSlug, genres } from "@/lib/catalog";

export function generateStaticParams() {
  return genres.map((g) => ({ slug: g.toLowerCase().replace(/\s+/g, "-") }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const genre = genreFromSlug(slug);
  return { title: genre ? `${genre} — Netflix` : "Browse — Netflix" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const genre = genreFromSlug(slug);
  if (!genre) notFound();
  const list = byGenre(genre);
  return (
    <BrowseGrid
      titles={list}
      heading={genre}
      subheading={`${list.length} titles tagged ${genre} — sorted by how well they match your taste.`}
      initialGenre={genre}
      lockGenre
    />
  );
}
