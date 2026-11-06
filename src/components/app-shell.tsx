"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { profiles, useStore } from "@/components/store";
import { TitleModal } from "@/components/title-modal";
import { SearchOverlay } from "@/components/search-overlay";
import { Wordmark } from "@/components/wordmark";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { hydrated, profile, setProfile, splash, setSplash, toasts } = useStore();
  const [picking, setPicking] = useState(false);

  // auto-dismiss the tudum-style splash
  useEffect(() => {
    if (!splash) return;
    const timer = window.setTimeout(() => setSplash(false), 1900);
    return () => window.clearTimeout(timer);
  }, [splash, setSplash]);

  return (
    <>
      {children}

      <AnimatePresence>
        {hydrated && !profile && (
          <ProfileGate
            onPick={(p) => {
              setProfile(p);
              setPicking(true);
              setSplash(true);
              window.setTimeout(() => setPicking(false), 400);
            }}
            picking={picking}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{splash && <TudumSplash onDone={() => setSplash(false)} />}</AnimatePresence>

      <TitleModal />
      <SearchOverlay />

      {/* toasts */}
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

function ProfileGate({
  onPick,
  picking,
}: {
  onPick: (p: (typeof profiles)[number]) => void;
  picking: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#141414] px-6"
    >
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-6 md:px-12">
        <Wordmark className="text-2xl md:text-3xl" />
        <span className="text-xs uppercase tracking-[0.25em] text-white/40">Clone demo</span>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="mb-10 text-center text-3xl font-medium tracking-tight text-white md:text-5xl"
      >
        Who&apos;s watching?
      </motion.h1>

      <div className="flex flex-wrap items-start justify-center gap-5 md:gap-8">
        {profiles.map((p, i) => (
          <motion.button
            key={p.id}
            type="button"
            onClick={() => !picking && onPick(p)}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 + i * 0.07, type: "spring", stiffness: 260, damping: 26 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.97 }}
            className="focus-brand group flex w-[104px] flex-col items-center gap-3 md:w-[136px]"
          >
            <span
              className={`relative grid aspect-square w-full place-items-center overflow-hidden rounded-lg bg-gradient-to-br ${p.gradient} ring-2 ring-transparent transition group-hover:ring-white`}
            >
              <span className="text-4xl drop-shadow-lg md:text-5xl">{p.emoji}</span>
              <span className="absolute inset-0 bg-black/10 transition group-hover:bg-black/0" />
            </span>
            <span className="text-sm text-[#8c8c8c] transition group-hover:text-white md:text-base">
              {p.name}
            </span>
          </motion.button>
        ))}
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        type="button"
        className="mt-12 border border-white/40 px-6 py-2 text-sm uppercase tracking-[0.2em] text-[#8c8c8c] transition hover:border-white hover:text-white"
      >
        Manage Profiles
      </motion.button>
    </motion.div>
  );
}

function TudumSplash({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      onClick={onDone}
      className="fixed inset-0 z-[110] grid cursor-pointer place-items-center bg-black"
    >
      <div className="relative overflow-hidden">
        <motion.div
          initial={{ scale: 0.82, opacity: 0 }}
          animate={{ scale: [0.82, 1.06, 1], opacity: [0, 1, 1] }}
          transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
          className="sweep relative font-display text-[26vw] leading-none text-netflix-red drop-shadow-[0_0_60px_rgba(229,9,20,0.55)] md:text-[18vw]"
        >
          N
        </motion.div>
      </div>
    </motion.div>
  );
}
