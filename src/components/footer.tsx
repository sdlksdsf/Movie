import Link from "next/link";
import { genres, genreSlug } from "@/lib/catalog";

const columns = [
  [
    { label: "Home", href: "/" },
    { label: "TV Shows", href: "/tv-shows" },
    { label: "Movies", href: "/movies" },
    { label: "Anime", href: "/anime" },
  ],
  [
    { label: "Browse all titles", href: "/browse" },
    { label: "My List", href: "/my-list" },
    { label: "New & Popular", href: "/new-popular" },
  ],
  [
    { label: "Settings", href: "/settings" },
    { label: "Appearance", href: "/settings?tab=appearance" },
    { label: "Developer status", href: "/settings?tab=developer" },
    { label: "About NOFLIX", href: "/about" },
  ],
  [
    { label: "Privacy policy", href: "/privacy" },
    { label: "Terms of use", href: "/terms" },
    { label: "Copyright & DMCA", href: "/dmca" },
    { label: "Source on GitHub", href: "https://github.com/sdlksdsf/Movie" },
  ],
];

export function Footer() {
  return (
    <footer className="mt-10 border-t border-white/5 px-4 pb-16 pt-10 text-[13px] text-[#808080] md:px-12">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-6 flex items-center gap-4 text-white/80">
          <a
          href="https://github.com/sdlksdsf/Movie"
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/25 px-3 py-1 text-[11px] uppercase tracking-wider transition hover:border-white/60 hover:text-white"
        >
          GitHub ↗
        </a>
        <a
          href="/about"
          className="rounded-full border border-white/25 px-3 py-1 text-[11px] uppercase tracking-wider transition hover:border-white/60 hover:text-white"
        >
          About NOFLIX
        </a>
        </div>

        <div className="grid grid-cols-2 gap-y-3 sm:grid-cols-4">
          {columns.map((col, i) => (
            <div key={i} className="flex flex-col gap-3">
              {col.map((link) => (
                <Link key={link.label} href={link.href} className="transition hover:text-white hover:underline">
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {genres.slice(0, 12).map((genre) => (
            <Link
              key={genre}
              href={`/genre/${genreSlug(genre)}`}
              className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/50 transition hover:border-white/40 hover:text-white"
            >
              {genre}
            </Link>
          ))}
        </div>

        <div className="mt-8 space-y-2 text-[11px] leading-relaxed text-white/35">
          <p>
            A NOFLIX-inspired demo built with Next.js, Tailwind CSS and Framer Motion. All titles,
            artwork and metadata belong to their respective rights holders.
          </p>
          <p>
            Playback is delivered through the third-party CineLite embed. If a stream doesn&apos;t
            start, the source may be temporarily unavailable — try another title or server.
          </p>
          <p className="pt-2">NOFLIX Clone · Karachi, Pakistan</p>
        </div>
      </div>
    </footer>
  );
}
