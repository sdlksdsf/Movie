import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * NOFLIX-style wordmark. We render it as real text (Anton) instead of using
 * the trademarked logo file, and give it the signature red + letterspacing.
 */
export function Wordmark({
  className,
  href = "/",
  asLink = true,
}: {
  className?: string;
  href?: string;
  asLink?: boolean;
}) {
  const content = (
    <span
      className={cn(
        "wordmark select-none text-[#e50914] drop-shadow-[0_2px_10px_rgba(229,9,20,0.35)]",
        className,
      )}
      aria-label="NOFLIX"
    >
      NOFLIX
    </span>
  );

  if (!asLink) return content;

  return (
    <Link href={href} className="focus-brand inline-flex shrink-0 items-center" aria-label="NOFLIX home">
      {content}
    </Link>
  );
}
