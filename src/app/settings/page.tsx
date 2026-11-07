import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsScreen } from "@/components/settings-screen";

export const metadata: Metadata = { title: "Settings — NOFLIX" };

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#141414]" />}>
      <SettingsScreen />
    </Suspense>
  );
}
