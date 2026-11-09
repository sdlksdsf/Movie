import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/anton/400.css";
import "./globals.css";
import { StoreProvider } from "@/components/store";
import { AppShell } from "@/components/app-shell";
import { BootIntro } from "@/components/boot-intro";

export const metadata: Metadata = {
  title: "NOFLIX — Watch TV Shows Online, Watch Movies Online",
  description:
    "A pixel-faithful NOFLIX experience: browse thousands of titles, hover to preview, and stream instantly in the built-in player.",
  applicationName: "NOFLIX",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
};

/**
 * Everything the first paint needs, inline.
 *
 * Browsers block on this style but not on the stylesheet bundle, so inlining the
 * boot keyframes means the title card is already animating while the rest of
 * the CSS is still downloading. Nothing of the interface can appear first.
 */
const CRITICAL_CSS = `
html,body{background:#141414;color:#fff;margin:0;min-height:100%}
#nf-boot{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;overflow:hidden;background:#000;animation:nf-boot-out .5s ease-in 2.05s forwards}
.nf-boot-glow{position:absolute;width:70vmin;height:70vmin;border-radius:9999px;background:rgba(229,9,20,.42);filter:blur(130px);opacity:0;animation:nf-boot-glow 2.4s ease-in-out forwards}
.nf-boot-bars{position:absolute;display:flex;align-items:center;gap:8px;height:120px}
.nf-boot-bars i{display:block;width:14px;height:100%;border-radius:2px;background:#e50914;transform:scaleY(0);transform-origin:center;animation:nf-boot-bar 1.5s ease-in-out forwards}
.nf-boot-bars i:nth-child(2){animation-delay:.06s}
.nf-boot-bars i:nth-child(3){animation-delay:.12s}
.nf-boot-word{position:absolute;margin-top:190px;font-family:var(--font-display);font-size:clamp(28px,6vw,54px);letter-spacing:.42em;text-indent:.42em;color:#fff;opacity:0;animation:nf-boot-word 2.4s cubic-bezier(.2,.8,.2,1) forwards}
.nf-boot-rule{position:absolute;height:2px;width:0;background:linear-gradient(90deg,transparent,#e50914,transparent);animation:nf-boot-rule 1.6s ease-in-out .3s forwards}
@keyframes nf-boot-bar{0%{transform:scaleY(0);opacity:0}32%{transform:scaleY(1);opacity:1}66%{transform:scaleY(1);opacity:1}100%{transform:scaleY(0);opacity:0}}
@keyframes nf-boot-glow{0%{opacity:0;transform:scale(.6)}40%{opacity:.6}75%{opacity:.35;transform:scale(1.12)}100%{opacity:0;transform:scale(1.5)}}
@keyframes nf-boot-word{0%{opacity:0;transform:translateY(16px) scale(.94)}36%{opacity:1;transform:translateY(0) scale(1)}76%{opacity:1;transform:scale(1.03)}100%{opacity:0;transform:scale(1.12)}}
@keyframes nf-boot-rule{0%{width:0;opacity:0}40%{width:46vmin;opacity:.9}100%{width:70vmin;opacity:0}}
@keyframes nf-boot-out{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){#nf-boot{animation:nf-boot-out .2s linear forwards}.nf-boot-bars i,.nf-boot-glow,.nf-boot-word,.nf-boot-rule{animation:none;opacity:0}}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ backgroundColor: "#141414", colorScheme: "dark" }}>
      <head>
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="" />
        <link rel="preconnect" href="https://m.media-amazon.com" crossOrigin="" />
        <link rel="preconnect" href="https://images.metahub.space" crossOrigin="" />
        <link rel="dns-prefetch" href="https://api.themoviedb.org" />
        <link rel="dns-prefetch" href="https://www.youtube-nocookie.com" />
        {/* critical CSS: the dark background and the whole boot card, inline so
            the title card animates on the very first paint — before the
            stylesheet, before hydration, before any script */}
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
      </head>
      <body className="min-h-screen bg-[#141414] text-white antialiased">
        {/* server-rendered so the title card is the first paint, never a flash */}
        <BootIntro />
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
