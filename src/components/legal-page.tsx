import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import type { ReactNode } from "react";

export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pb-16 pt-24 md:pt-28">
        <article className="mx-auto max-w-[760px] px-4 md:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--nf-accent)]">
            {eyebrow}
          </p>
          <h1 className="mt-1 font-display text-[clamp(1.8rem,4vw,2.7rem)] leading-none text-white">
            {title}
          </h1>
          {updated && <p className="mt-2 text-[12px] text-white/35">Last updated {updated}</p>}

          <div className="mt-7 space-y-5 text-[13.5px] leading-relaxed text-white/65 [&_a]:text-[var(--nf-accent)] [&_a:hover]:underline [&_h2]:mt-8 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mt-5 [&_h3]:text-[13.5px] [&_h3]:font-semibold [&_h3]:text-white/90 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
            {children}
          </div>

          <div className="mt-10 flex flex-wrap gap-2 border-t border-white/10 pt-5 text-[12px]">
            {[
              { href: "/about", label: "About" },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
              { href: "/dmca", label: "Copyright" },
              { href: "/settings", label: "Settings" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-white/15 px-3 py-1 text-white/55 transition hover:border-white/40 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
