"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { ProfileGate } from "@/components/profile-gate";
import { TitleModal } from "@/components/title-modal";
import { SearchOverlay } from "@/components/search-overlay";
import { SoundNotice } from "@/components/sound-notice";
import { CloudSync } from "@/components/cloud-sync";
import { useStore } from "@/components/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { hydrated, profile, setProfile, toasts } = useStore();
  return (
    <>
      {children}

      <CloudSync />

      <AnimatePresence>
        {hydrated && !profile && (
          <ProfileGate
            onPick={(picked) => setProfile(picked)}
          />
        )}
      </AnimatePresence>

      <SoundNotice />
      <TitleModal />
      <SearchOverlay />

      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[120] flex -translate-x-1/2 flex-col items-center gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="rounded-md border border-white/10 bg-[#1f1f1f]/95 px-5 py-3 text-sm font-medium text-white shadow-2xl backdrop-blur"
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
