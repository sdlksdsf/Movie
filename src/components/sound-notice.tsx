"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CloseIcon, MuteIcon } from "@/components/icons";
import { openInOwnTab, soundIsBlocked } from "@/lib/media";

const KEY = "nf.soundNotice";

/**
 * Some hosts (preview shells, sandboxed frames) do not delegate the `autoplay`
 * feature to the pages they embed. Every embedded player then refuses to make
 * sound and pauses when asked to — the picture is fine muted, dead unmuted.
 * We cannot override a browser policy, but we can stop the guessing and offer
 * the one thing that works: the site in its own tab.
 */
export function SoundNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(KEY) === "1";
    } catch {
      /* private mode */
    }
    if (!dismissed && soundIsBlocked()) setShow(true);
  }, []);

  const close = () => {
    setShow(false);
    try {
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-3 top-3 z-[130] mx-auto flex max-w-[560px] items-center gap-2.5 rounded-lg border border-white/12 bg-[#181818]/97 px-3 py-2.5 shadow-2xl backdrop-blur-xl md:inset-x-auto md:right-4 md:top-4"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-white/80">
            <MuteIcon width={15} height={15} />
          </span>
          <p className="min-w-0 flex-1 text-[12px] leading-snug text-white/80">
            This preview frame blocks audio. Open NOFLIX in its own tab to hear everything.
          </p>
          <button
            type="button"
            onClick={openInOwnTab}
            className="focus-brand shrink-0 rounded-md bg-[var(--nf-accent)] px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition hover:brightness-110"
          >
            Open ↗
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Dismiss"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
          >
            <CloseIcon width={13} height={13} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
