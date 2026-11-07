import Link from "next/link";
import { genres, genreSlug } from "@/lib/catalog";

const columns = [
  [
    { label: "Audio Description", href: "/browse" },
    { label: "Help Centre", href: "/browse" },
    { label: "Gift Cards", href: "/browse" },
    { label: "Media Centre", href: "/browse" },
  ],
  [
    { label: "Investor Relations", href: "/browse" },
    { label: "Jobs", href: "/browse" },
    { label: "Terms of Use", href: "/browse" },
    { label: "Privacy", href: "/browse" },
  ],
  [
    { label: "Legal Notices", href: "/browse" },
    { label: "Cookie Preferences", href: "/browse" },
    { label: "Corporate Information", href: "/browse" },
    { label: "Contact Us", href: "/browse" },
  ],
];

export function Footer() {
  return (
    <footer className="mt-10 border-t border-white/5 px-4 pb-16 pt-10 text-[13px] text-[#808080] md:px-12">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-6 flex items-center gap-4 text-white/80">
          {["facebook", "instagram", "twitter", "youtube"].map((network) => (
            <span
              key={network}
              aria-label={network}
              className="grid h-7 w-7 place-items-center rounded-full border border-white/25 text-[10px] uppercase tracking-wider transition hover:border-white/60"
            >
              {network.slice(0, 2)}
            </span>
          ))}
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
