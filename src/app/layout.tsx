import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/anton/400.css";
import "./globals.css";
import { StoreProvider } from "@/components/store";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Netflix — Watch TV Shows Online, Watch Movies Online",
  description:
    "A pixel-faithful Netflix experience: browse thousands of titles, hover to preview, and stream instantly in the built-in player.",
  applicationName: "Netflix",
  themeColor: "#000000",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#141414] text-white antialiased">
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
