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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ backgroundColor: "#141414", colorScheme: "dark" }}>
      <head>
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="" />
        <link rel="preconnect" href="https://m.media-amazon.com" crossOrigin="" />
        <link rel="preconnect" href="https://images.metahub.space" crossOrigin="" />
        <link rel="dns-prefetch" href="https://api.themoviedb.org" />
        <link rel="dns-prefetch" href="https://www.youtube-nocookie.com" />
        {/* paint the dark background before the stylesheet arrives — kills the white flash */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              "html,body{background:#141414;color:#fff;margin:0;min-height:100%}#nf-boot{position:fixed;inset:0;background:#000;z-index:9999}",
          }}
        />
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
