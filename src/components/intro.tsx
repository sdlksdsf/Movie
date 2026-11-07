"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";

/**
 * NOFLIX title card: the red bars snap together into the mark, the wordmark
 * rises, a light sweeps across and the whole thing punches through into the app.
 * Click or any key skips it.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2600);
    const skip = () => onDone();
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [onDone]);

  const letters = "NOFLIX".split("");

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeInOut" }}
      className="fixed inset-0 z-[110] grid cursor-pointer place-items-center overflow-hidden bg-black"
      aria-label="NOFLIX"
    >
      {/* glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.55, 0.3, 0.75, 0], scale: [0.6, 1.05, 1.1, 1.25, 1.5] }}
        transition={{ duration: 2.6, ease: "easeInOut" }}
        className="absolute h-[70vh] w-[70vh] rounded-full bg-[#e50914]/40 blur-[130px]"
      />

      {/* three bars forming the N */}
      <div className="absolute flex h-[120px] items-center justify-center gap-2 md:h-[160px]">
        {[0, 1, 2].map((bar) => (
          <motion.span
            key={bar}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.5, times: [0, 0.32, 0.62, 1], delay: bar * 0.06, ease: "easeInOut" }}
            className="w-[14px] origin-center rounded-[2px] bg-[#e50914] md:w-[18px]"
            style={{ height: bar === 1 ? "100%" : "100%", rotate: bar === 1 ? "0deg" : "0deg" }}
          />
        ))}
      </div>

      {/* wordmark */}
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.92, 1, 1.04, 1.18] }}
        transition={{ duration: 2.6, times: [0, 0.42, 0.78, 1], ease: "easeInOut" }}
        className="relative flex select-none items-end font-display text-[13vw] leading-none tracking-[0.02em] text-white md:text-[9vw]"
      >
        {letters.map((letter, index) => (
          <motion.span
            key={`${letter}-${index}`}
            initial={{ y: 26, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.9 + index * 0.055, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={index === 0 ? "text-[#e50914]" : undefined}
          >
            {letter}
          </motion.span>
        ))}

        {/* light sweep */}
        <motion.span
          initial={{ x: "-120%", opacity: 0 }}
          animate={{ x: ["-120%", "120%"], opacity: [0, 0.85, 0] }}
          transition={{ delay: 1.25, duration: 0.9, ease: "easeInOut" }}
          className="pointer-events-none absolute inset-y-0 -inset-x-6 bg-gradient-to-r from-transparent via-white/70 to-transparent mix-blend-overlay"
        />
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.6, 0] }}
        transition={{ duration: 2.6, times: [0, 0.5, 0.72, 1] }}
        className="absolute bottom-[18%] text-[10px] uppercase tracking-[0.5em] text-white/40"
      >
        Unlimited films &amp; series
      </motion.p>
    </motion.div>
  );
}
