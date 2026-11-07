import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Artwork } from "@/components/artwork";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { PosterTile } from "@/components/row";
import { PlayIcon } from "@/components/icons";
import { HeroTrailer } from "@/components/trailer";
import {
  allTitles,
  formatRuntime,
  getTitle,
  seasonsFor,
  shortMeta,
  similarTo,
} from "@/lib/catalog";

export function generateStaticParams() {
  return allTitles.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = getTitle(slug);
  return {
    title: title ? `${title.name} (${title.year}) — NOFLIX` : "NOFLIX",
    description: title?.overview,
  };
}

export default async function TitlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = getTitle(slug);
  if (!title) notFound();

  const seasons = seasonsFor(title);
  const alike = similarTo(title, 9);

  return (
    <>
      <Navbar />
      <main>
        <section className="relative h-[62svh] min-h-[420px] w-full overflow-hidden">
          <div className="absolute inset-0">
            <Artwork slug={title.slug} name={title.name} kind="backdrop" accent={title.accent} priority sizes="100vw" />
          </div>
          {title.tmdbId ? <HeroTrailer tmdbId={title.tmdbId} kind={title.kind} /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/50 to-[#141414]/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-transparent to-transparent" />

          <div className="absolute inset-x-0 bottom-0 flex items-end gap-6 px-4 pb-10 md:px-12">
            <div className="hidden w-[170px] shrink-0 overflow-hidden rounded-md shadow-2xl md:block">
              <div className="relative aspect-[2/3]">
                <Artwork slug={title.slug} name={title.name} accent={title.accent} sizes="200px" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
                <span className="font-display text-lg leading-none text-netflix-red">N</span>
                {title.kind === "series" ? "Series" : "Film"}
              </div>
              <h1 className="font-display text-[clamp(2.2rem,5.5vw,4.6rem)] leading-[0.94] text-white">
                {title.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-white/80">
                <span className="font-semibold text-[#46d369]">{title.match}% Match</span>
                <span>{title.year}</span>
                <span className="rounded border border-white/40 px-1.5 py-[1px] text-[11px]">
                  {title.maturity}
                </span>
                <span>{title.kind === "movie" ? formatRuntime(title.runtime) : shortMeta(title)}</span>
              </div>
              <p className="mt-4 max-w-[640px] text-sm leading-relaxed text-white/75">{title.overview}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={
                    title.kind === "series"
                      ? `/watch/series/${title.slug}?s=1&e=1`
                      : `/watch/movie/${title.slug}`
                  }
                  className="flex items-center gap-2 rounded-[4px] bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/85"
                >
                  <PlayIcon width={18} height={18} />
                  Play
                </Link>
                <Link
                  href="/browse"
                  className="rounded-[4px] bg-white/20 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/30"
                >
                  More like this
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="px-4 pb-16 md:px-12">
          <div className="mx-auto max-w-[1400px]">
            <div className="grid gap-6 border-b border-white/10 py-8 md:grid-cols-[1.7fr_1fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-netflix-red">
                  {title.tagline}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{title.genres.join(" · ")}</p>
              </div>
              <div className="space-y-2 text-[13px] leading-relaxed">
                <p>
                  <span className="text-white/40">Cast: </span>
                  <span className="text-white/85">{title.cast.join(", ")}</span>
                </p>
                <p>
                  <span className="text-white/40">Creator: </span>
                  <span className="text-white/85">{title.creator}</span>
                </p>
              </div>
            </div>

            {seasons.length > 0 && (
              <div className="py-8">
                <h2 className="mb-4 text-lg font-semibold text-white">Episodes</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {seasons[0].episodes.map((ep) => (
                    <Link
                      key={ep.number}
                      href={`/watch/series/${title.slug}?s=1&e=${ep.number}`}
                      className="group flex items-center gap-4 rounded-md border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/20 hover:bg-white/[0.05]"
                    >
                      <span className="w-4 text-center text-sm text-white/40">{ep.number}</span>
                      <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded bg-[#222]">
                        <Artwork
                          slug={title.slug}
                          name=""
                          kind="backdrop"
                          accent={title.accent}
                          sizes="140px"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13.5px] font-medium text-white">{ep.name}</span>
                          <span className="text-[11px] text-white/45">{ep.runtime}m</span>
                        </span>
                        <span className="mt-0.5 line-clamp-1 block text-[11.5px] text-white/50">
                          {ep.overview}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4">
              <h2 className="mb-4 text-lg font-semibold text-white">More Like This</h2>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-9">
                {alike.map((t) => (
                  <PosterTile key={t.slug} title={t} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
