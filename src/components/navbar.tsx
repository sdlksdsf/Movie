"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Artwork } from "@/components/artwork";
import { BellIcon, ChevronDownIcon, SearchIcon } from "@/components/icons";
import { profiles, useStore } from "@/components/store";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/cn";
import { allTitles } from "@/lib/catalog";

const links = [
  { href: "/", label: "Home" },
  { href: "/tv-shows", label: "TV Shows" },
  { href: "/movies", label: "Movies" },
  { href: "/new-popular", label: "New & Popular" },
  { href: "/my-list", label: "My List" },
  { href: "/browse", label: "Browse by Languages" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, setProfile, setSearchOpen, hydrated } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState<null | "profile" | "bell">(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24);
        ticking.current = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenu(null);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const notifications = allTitles.slice(0, 3);

  return (
    <header
      ref={shellRef}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,box-shadow] duration-500",
        scrolled
          ? "bg-[#141414]/95 shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur-md"
          : "bg-gradient-to-b from-black/85 via-black/45 to-transparent",
      )}
    >
      <nav className="mx-auto flex h-[68px] w-full items-center gap-4 px-4 md:gap-7 md:px-12">
        <Wordmark className="text-[22px] md:text-[26px]" />

        <ul className="hidden items-center gap-6 text-[13.5px] lg:flex">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "focus-brand whitespace-nowrap transition-colors duration-200",
                    active ? "font-semibold text-white" : "text-[#e5e5e5]/85 hover:text-white",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* mobile: compact links */}
        <ul className="no-scrollbar flex flex-1 items-center gap-4 overflow-x-auto text-[13px] lg:hidden">
          <li>
            <Link href="/tv-shows" className="whitespace-nowrap text-white/80">
              TV Shows
            </Link>
          </li>
          <li>
            <Link href="/movies" className="whitespace-nowrap text-white/80">
              Movies
            </Link>
          </li>
          <li>
            <Link href="/my-list" className="whitespace-nowrap text-white/80">
              My List
            </Link>
          </li>
        </ul>

        <div className="ml-auto flex items-center gap-3 md:gap-5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search titles"
            className="focus-brand grid h-9 w-9 place-items-center rounded-full text-white/90 transition hover:bg-white/10 hover:text-white"
          >
            <SearchIcon width={19} height={19} />
          </button>

          <span className="hidden text-[13px] text-white/80 sm:block">Kids</span>

          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => setMenu((m) => (m === "bell" ? null : "bell"))}
              className="focus-brand relative grid h-9 w-9 place-items-center rounded-full text-white/90 transition hover:bg-white/10 hover:text-white"
            >
              <BellIcon width={19} height={19} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-netflix-red" />
            </button>
            <AnimatePresence>
              {menu === "bell" && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 top-12 w-[320px] overflow-hidden rounded-md border border-white/15 bg-[#191919]/98 py-2 shadow-2xl backdrop-blur-xl"
                >
                  <p className="px-4 pb-2 text-xs uppercase tracking-[0.18em] text-white/40">
                    New arrivals
                  </p>
                  {notifications.map((t) => (
                    <button
                      key={t.slug}
                      type="button"
                      onClick={() => {
                        setMenu(null);
                        router.push(`/title/${t.slug}`);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-white/5"
                    >
                      <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded">
                        <Artwork slug={t.slug} name={t.name} accent={t.accent} sizes="60px" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-white">{t.name}</span>
                        <span className="block text-xs text-white/50">
                          {t.badge ?? "Now streaming"} · {t.year}
                        </span>
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((m) => (m === "profile" ? null : "profile"))}
              className="focus-brand flex items-center gap-2 rounded-md p-0.5 transition hover:opacity-90"
              aria-label="Account menu"
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded bg-gradient-to-br text-sm",
                  hydrated && profile ? profile.gradient : "from-[#e50914] to-[#7f1d1d]",
                )}
              >
                {hydrated && profile ? profile.emoji : "🍿"}
              </span>
              <ChevronDownIcon
                width={16}
                height={16}
                className={cn("hidden transition-transform sm:block", menu === "profile" && "rotate-180")}
              />
            </button>

            <AnimatePresence>
              {menu === "profile" && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 top-12 w-[240px] overflow-hidden rounded-md border border-white/15 bg-[#191919]/98 shadow-2xl backdrop-blur-xl"
                >
                  <div className="py-2">
                    {profiles
                      .filter((p) => p.id !== profile?.id)
                      .slice(0, 2)
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setProfile(p);
                            setMenu(null);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2 text-sm text-white/90 transition hover:underline"
                        >
                          <span
                            className={cn(
                              "grid h-8 w-8 place-items-center rounded bg-gradient-to-br",
                              p.gradient,
                            )}
                          >
                            {p.emoji}
                          </span>
                          {p.name}
                        </button>
                      ))}
                  </div>
                  <div className="border-t border-white/10 py-2 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setProfile(null);
                        setMenu(null);
                      }}
                      className="block w-full px-4 py-2 text-left text-white/90 transition hover:underline"
                    >
                      Manage Profiles
                    </button>
                    <Link
                      href="/my-list"
                      onClick={() => setMenu(null)}
                      className="block px-4 py-2 text-white/90 transition hover:underline"
                    >
                      My List
                    </Link>
                    <Link
                      href="/browse"
                      onClick={() => setMenu(null)}
                      className="block px-4 py-2 text-white/90 transition hover:underline"
                    >
                      Browse All Titles
                    </Link>
                    <p className="px-4 pt-3 pb-1 text-xs leading-relaxed text-white/35">
                      Demo build — data &amp; artwork belong to their owners.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>
    </header>
  );
}
