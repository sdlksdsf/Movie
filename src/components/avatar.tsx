"use client";

import type { AvatarId } from "@/lib/avatars";
import { cn } from "@/lib/cn";

/**
 * Vector profile art. Everything is drawn in white / black opacities so the
 * chosen profile colour shows through and the character stays legible at
 * 28 px in the navbar or 200 px on the profile screen.
 */
export function AvatarArt({ id }: { id: AvatarId }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden focusable="false">
      {art(id)}
    </svg>
  );
}

function art(id: AvatarId) {
  switch (id) {
    case "robot":
      return (
        <>
          <circle cx="50" cy="16" r="4.5" fill="#fff" opacity="0.9" />
          <rect x="48.4" y="16" width="3.2" height="14" rx="1.6" fill="#fff" opacity="0.75" />
          <rect x="16" y="44" width="7" height="18" rx="3.5" fill="#fff" opacity="0.75" />
          <rect x="77" y="44" width="7" height="18" rx="3.5" fill="#fff" opacity="0.75" />
          <rect x="22" y="29" width="56" height="46" rx="13" fill="#fff" opacity="0.93" />
          <circle cx="38" cy="48" r="5.4" fill="#0b0b0b" opacity="0.6" />
          <circle cx="62" cy="48" r="5.4" fill="#0b0b0b" opacity="0.6" />
          <rect x="39" y="61" width="22" height="3.6" rx="1.8" fill="#0b0b0b" opacity="0.35" />
          <rect x="45" y="67" width="10" height="3" rx="1.5" fill="#0b0b0b" opacity="0.25" />
        </>
      );
    case "astro":
      return (
        <>
          <circle cx="50" cy="52" r="31" fill="#fff" opacity="0.93" />
          <rect x="27" y="37" width="46" height="31" rx="15.5" fill="#0b0b0b" opacity="0.55" />
          <rect x="33" y="43" width="12" height="5.5" rx="2.75" fill="#fff" opacity="0.55" />
          <circle cx="21" cy="30" r="2.4" fill="#fff" opacity="0.7" />
          <circle cx="80" cy="24" r="3" fill="#fff" opacity="0.55" />
          <path d="M50 84v9M42 89h16" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
        </>
      );
    case "panda":
      return (
        <>
          <circle cx="27" cy="27" r="13" fill="#0b0b0b" opacity="0.5" />
          <circle cx="73" cy="27" r="13" fill="#0b0b0b" opacity="0.5" />
          <circle cx="50" cy="53" r="29" fill="#fff" opacity="0.95" />
          <ellipse cx="38" cy="49" rx="9.5" ry="11.5" fill="#0b0b0b" opacity="0.5" />
          <ellipse cx="62" cy="49" rx="9.5" ry="11.5" fill="#0b0b0b" opacity="0.5" />
          <circle cx="38" cy="48" r="3.4" fill="#fff" />
          <circle cx="62" cy="48" r="3.4" fill="#fff" />
          <ellipse cx="50" cy="66" rx="7" ry="4.6" fill="#0b0b0b" opacity="0.5" />
        </>
      );
    case "fox":
      return (
        <>
          <path d="M23 40 30 12l16 16Z" fill="#fff" opacity="0.9" />
          <path d="M77 40 70 12 54 28Z" fill="#fff" opacity="0.9" />
          <path d="M50 22 79 46 71 78a26 26 0 0 1-42 0L21 46Z" fill="#fff" opacity="0.93" />
          <ellipse cx="50" cy="66" rx="15" ry="10" fill="#0b0b0b" opacity="0.16" />
          <circle cx="41" cy="50" r="4" fill="#0b0b0b" opacity="0.62" />
          <circle cx="59" cy="50" r="4" fill="#0b0b0b" opacity="0.62" />
          <ellipse cx="50" cy="63" rx="4.6" ry="3.4" fill="#0b0b0b" opacity="0.7" />
        </>
      );
    case "hero":
      return (
        <>
          <path d="M14 96h72c0-16-16-24-36-24S14 80 14 96Z" fill="#fff" opacity="0.35" />
          <circle cx="50" cy="46" r="23" fill="#fff" opacity="0.93" />
          <path d="M27 40h46v14a23 23 0 0 1-46 0Z" fill="#0b0b0b" opacity="0.62" />
          <path d="M33 45c4-4 10-4 14 0-4 5-10 5-14 0Z" fill="#fff" opacity="0.95" />
          <path d="M53 45c4-4 10-4 14 0-4 5-10 5-14 0Z" fill="#fff" opacity="0.95" />
          <path d="M43 68h14" stroke="#0b0b0b" strokeWidth="3.4" strokeLinecap="round" opacity="0.3" />
        </>
      );
    case "cat":
      return (
        <>
          <path d="M24 42 26 16l20 14Z" fill="#fff" opacity="0.93" />
          <path d="M76 42 74 16 54 30Z" fill="#fff" opacity="0.93" />
          <circle cx="50" cy="55" r="27" fill="#fff" opacity="0.95" />
          <ellipse cx="39" cy="52" rx="5" ry="6.4" fill="#0b0b0b" opacity="0.6" />
          <ellipse cx="61" cy="52" rx="5" ry="6.4" fill="#0b0b0b" opacity="0.6" />
          <path d="M50 63 45 68h10Z" fill="#0b0b0b" opacity="0.65" />
          <path
            d="M28 60h-14M28 66h-13M72 60h14M72 66h13"
            stroke="#0b0b0b"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.3"
          />
        </>
      );
    case "alien":
      return (
        <>
          <path d="M34 22 28 8" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" opacity="0.85" />
          <path d="M66 22 72 8" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" opacity="0.85" />
          <circle cx="27" cy="7" r="4" fill="#fff" opacity="0.85" />
          <circle cx="73" cy="7" r="4" fill="#fff" opacity="0.85" />
          <ellipse cx="50" cy="52" rx="27" ry="33" fill="#fff" opacity="0.93" />
          <ellipse cx="38" cy="52" rx="9" ry="12" fill="#0b0b0b" opacity="0.6" transform="rotate(-12 38 52)" />
          <ellipse cx="62" cy="52" rx="9" ry="12" fill="#0b0b0b" opacity="0.6" transform="rotate(12 62 52)" />
          <path d="M43 72c4 3 10 3 14 0" stroke="#0b0b0b" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
        </>
      );
    case "dragon":
      return (
        <>
          <path d="M34 26c-3-9 2-16 8-18-2 8 2 12 6 15Z" fill="#fff" opacity="0.9" />
          <path d="M66 26c3-9-2-16-8-18 2 8-2 12-6 15Z" fill="#fff" opacity="0.9" />
          <path d="M50 20 78 44l-7 32a24 24 0 0 1-42 0L22 44Z" fill="#fff" opacity="0.93" />
          <path d="M50 20 58 34 50 40 42 34Z" fill="#0b0b0b" opacity="0.25" />
          <circle cx="39" cy="50" r="4.4" fill="#0b0b0b" opacity="0.62" />
          <circle cx="61" cy="50" r="4.4" fill="#0b0b0b" opacity="0.62" />
          <path d="M40 68h20" stroke="#0b0b0b" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
        </>
      );
    case "unicorn":
      return (
        <>
          <path d="M50 8 62 34H38Z" fill="#fff" opacity="0.95" />
          <path d="M44 26h12M46 19h8" stroke="#0b0b0b" strokeWidth="2.4" opacity="0.25" />
          <path d="M50 28 76 44l-6 34a26 26 0 0 1-40 0L24 44Z" fill="#fff" opacity="0.93" />
          <path d="M26 46c-6 10-4 22 4 28-2-12 2-20 8-26Z" fill="#fff" opacity="0.45" />
          <circle cx="40" cy="52" r="4.2" fill="#0b0b0b" opacity="0.6" />
          <circle cx="60" cy="52" r="4.2" fill="#0b0b0b" opacity="0.6" />
          <ellipse cx="50" cy="70" rx="10" ry="6" fill="#0b0b0b" opacity="0.2" />
        </>
      );
    case "bear":
      return (
        <>
          <circle cx="26" cy="30" r="12" fill="#fff" opacity="0.9" />
          <circle cx="74" cy="30" r="12" fill="#fff" opacity="0.9" />
          <circle cx="50" cy="55" r="29" fill="#fff" opacity="0.95" />
          <circle cx="40" cy="50" r="3.6" fill="#0b0b0b" opacity="0.6" />
          <circle cx="60" cy="50" r="3.6" fill="#0b0b0b" opacity="0.6" />
          <ellipse cx="50" cy="67" rx="12" ry="9" fill="#0b0b0b" opacity="0.18" />
          <ellipse cx="50" cy="63" rx="5" ry="3.6" fill="#0b0b0b" opacity="0.6" />
        </>
      );
    case "ninja":
      return (
        <>
          <path d="M20 44h-12l8 8-8 8h12" fill="#fff" opacity="0.6" />
          <circle cx="50" cy="52" r="28" fill="#fff" opacity="0.93" />
          <rect x="22" y="40" width="56" height="17" rx="4" fill="#0b0b0b" opacity="0.6" />
          <rect x="33" y="46" width="9" height="5" rx="2.5" fill="#fff" opacity="0.95" />
          <rect x="58" y="46" width="9" height="5" rx="2.5" fill="#fff" opacity="0.95" />
          <path d="M34 68c10 6 22 6 32 0" stroke="#0b0b0b" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
        </>
      );
    case "reel":
    default:
      return (
        <>
          <circle cx="50" cy="50" r="30" fill="#fff" opacity="0.93" />
          <circle cx="50" cy="50" r="7" fill="#0b0b0b" opacity="0.35" />
          {[
            [50, 28],
            [72, 39],
            [72, 61],
            [50, 72],
            [28, 61],
            [28, 39],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6" fill="#0b0b0b" opacity="0.45" />
          ))}
          <path
            d="M84 16l2.6 6.4L93 25l-6.4 2.6L84 34l-2.6-6.4L75 25l6.4-2.6Z"
            fill="#fff"
            opacity="0.85"
          />
        </>
      );
  }
}

/** Square (or rounded) tile with the accent colour behind the character. */
export function ProfileAvatar({
  avatar,
  accent,
  size,
  className,
  rounded = "rounded-lg",
  kids,
}: {
  avatar: AvatarId;
  accent: string;
  size?: number;
  className?: string;
  rounded?: string;
  kids?: boolean;
}) {
  return (
    <span
      className={cn("relative grid place-items-center overflow-hidden", rounded, className)}
      style={{
        background: `linear-gradient(150deg, ${accent} 0%, color-mix(in srgb, ${accent} 55%, #000) 62%, #141414 100%)`,
        width: size,
        height: size,
      }}
    >
      <span className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,rgba(255,255,255,0.28),transparent_60%)]" />
      <span className="absolute inset-0 p-[9%]">
        <AvatarArt id={avatar} />
      </span>
      {kids && (
        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-[3px] text-center text-[7px] font-bold uppercase tracking-[0.18em] text-white/95">
          Kids
        </span>
      )}
    </span>
  );
}
