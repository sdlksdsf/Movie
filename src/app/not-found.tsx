import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#141414] px-6 text-center">
      <div>
        <Wordmark className="mx-auto text-3xl" />
        <h1 className="mt-10 text-4xl font-semibold text-white md:text-6xl">
          Lost your way?
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/55">
          Sorry, we can&apos;t find that page. You&apos;ll find lots to explore on the home page.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/85"
        >
          Netflix Home
        </Link>
        <p className="mt-10 text-xs uppercase tracking-[0.3em] text-white/25">
          Error Code <span className="text-white/60">NSES-404</span>
        </p>
      </div>
    </main>
  );
}
