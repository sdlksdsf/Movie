"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { AVATARS, useStore, type Profile } from "@/components/store";
import { Wordmark } from "@/components/wordmark";
import { PlusIcon, CheckIcon, CloseIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Entry experience: create an account the first time, then pick a profile.
 * Adult and Kids profiles are real — kids profiles only see family-safe titles.
 */
export function ProfileGate({ onPick }: { onPick: (profile: Profile) => void }) {
  const { profiles, addProfile, removeProfile } = useStore();
  const [mode, setMode] = useState<"pick" | "create" | "manage">(profiles.length ? "pick" : "create");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(0);
  const [kids, setKids] = useState(false);

  const create = () => {
    const label = name.trim() || (kids ? "Kids" : "You");
    const created = addProfile({
      name: label.slice(0, 18),
      emoji: AVATARS[avatar].emoji,
      gradient: AVATARS[avatar].gradient,
      kids,
    });
    onPick(created);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] overflow-y-auto bg-[#0b0b0b]"
    >
      {/* cinematic backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-[-20%] h-[60vh] w-[60vh] rounded-full bg-[#e50914]/25 blur-[120px]" />
        <div className="absolute -right-24 bottom-[-25%] h-[55vh] w-[55vh] rounded-full bg-[#3b0d0f]/70 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_20%,#080808_78%)]" />
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-[1100px] flex-col px-5 py-7 md:px-10">
        <header className="flex items-center justify-between">
          <Wordmark className="text-2xl md:text-3xl" />
          <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white/45">
            {kidsOnlyLabel(profiles, mode)}
          </span>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <AnimatePresence mode="wait">
            {mode === "create" ? (
              <motion.div
                key="create"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-[560px]"
              >
                <p className="mb-2 text-center text-[11px] uppercase tracking-[0.3em] text-[#e50914]">
                  {profiles.length ? "New profile" : "Welcome to NOFLIX"}
                </p>
                <h1 className="mb-8 text-center font-display text-3xl tracking-wide sm:text-4xl md:text-5xl">
                  {profiles.length ? "Add a profile" : "Create your account"}
                </h1>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl md:p-7">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                    Profile name
                  </label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && create()}
                    maxLength={18}
                    placeholder={kids ? "Kids" : "Your name"}
                    className="mb-6 w-full rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-base text-white outline-none transition placeholder:text-white/30 focus:border-[#e50914]"
                  />

                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                    Choose an avatar
                  </p>
                  <div className="mb-6 grid grid-cols-5 gap-2.5">
                    {AVATARS.map((option, index) => (
                      <button
                        key={option.emoji}
                        type="button"
                        onClick={() => setAvatar(index)}
                        aria-label={`Avatar ${index + 1}`}
                        className={cn(
                          "relative grid aspect-square place-items-center overflow-hidden rounded-lg bg-gradient-to-br text-2xl transition",
                          option.gradient,
                          index === avatar
                            ? "ring-2 ring-white ring-offset-2 ring-offset-[#111]"
                            : "opacity-70 hover:opacity-100",
                        )}
                      >
                        {option.emoji}
                        {index === avatar && (
                          <span className="absolute bottom-1 right-1 grid h-4 w-4 place-items-center rounded-full bg-white text-black">
                            <CheckIcon width={10} height={10} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                    Account type
                  </p>
                  <div className="mb-7 grid grid-cols-2 gap-3">
                    <TypeCard
                      active={!kids}
                      onClick={() => setKids(false)}
                      title="Adult"
                      subtitle="Every title, all maturity ratings"
                      emoji="🎬"
                    />
                    <TypeCard
                      active={kids}
                      onClick={() => setKids(true)}
                      title="Kids"
                      subtitle="Family-safe films & cartoons only"
                      emoji="🧸"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    {profiles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMode("pick")}
                        className="rounded-md px-4 py-3 text-sm text-white/60 transition hover:text-white"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={create}
                      className="flex-1 rounded-md bg-[#e50914] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#f6121d] active:scale-[0.99]"
                    >
                      {kids ? "Start kids profile" : "Start watching"}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="pick"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                <h1 className="mb-2 text-center font-display text-3xl tracking-wide sm:text-4xl md:text-5xl">
                  Who&apos;s watching?
                </h1>
                <p className="mb-10 text-center text-sm text-white/45">
                  {mode === "manage" ? "Tap a profile to remove it" : "Pick a profile or add a new one"}
                </p>

                <div className="flex flex-wrap items-start justify-center gap-5 md:gap-7">
                  {profiles.map((item, index) => (
                    <motion.button
                      key={item.id}
                      type="button"
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + index * 0.06, type: "spring", stiffness: 260, damping: 26 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (mode === "manage") {
                          removeProfile(item.id);
                          if (profiles.length <= 1) setMode("create");
                        } else {
                          onPick(item);
                        }
                      }}
                      className="group flex w-[92px] flex-col items-center gap-2.5 md:w-[116px]"
                    >
                      <span
                        className={cn(
                          "relative grid aspect-square w-full place-items-center overflow-hidden rounded-xl bg-gradient-to-br text-3xl ring-2 ring-transparent transition group-hover:ring-white md:text-4xl",
                          item.gradient,
                        )}
                      >
                        {item.emoji}
                        {mode === "manage" && (
                          <span className="absolute inset-0 grid place-items-center bg-black/70 text-white">
                            <CloseIcon width={24} height={24} />
                          </span>
                        )}
                        {item.kids && (
                          <span className="absolute bottom-0 left-0 right-0 bg-black/65 py-0.5 text-center text-[8px] font-bold uppercase tracking-[0.2em] text-white/90">
                            Kids
                          </span>
                        )}
                      </span>
                      <span className="truncate text-[13px] text-white/60 transition group-hover:text-white">
                        {item.name}
                      </span>
                    </motion.button>
                  ))}

                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + profiles.length * 0.06 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setName("");
                      setMode("create");
                    }}
                    className="group flex w-[92px] flex-col items-center gap-2.5 md:w-[116px]"
                  >
                    <span className="grid aspect-square w-full place-items-center rounded-xl border-2 border-dashed border-white/25 text-white/50 transition group-hover:border-white group-hover:text-white">
                      <PlusIcon width={26} height={26} />
                    </span>
                    <span className="text-[13px] text-white/60 transition group-hover:text-white">Add profile</span>
                  </motion.button>
                </div>

                <div className="mt-12 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setMode(mode === "manage" ? "pick" : "manage")}
                    className="border border-white/25 px-6 py-2 text-[11px] uppercase tracking-[0.22em] text-white/55 transition hover:border-white hover:text-white"
                  >
                    {mode === "manage" ? "Done" : "Manage profiles"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="pb-2 text-center text-[11px] text-white/25">
          NOFLIX · a streaming demo · profiles and progress stay on this device
        </footer>
      </div>
    </motion.div>
  );
}

function kidsOnlyLabel(profiles: Profile[], mode: string) {
  if (mode === "create") return profiles.length ? "New profile" : "Get started";
  const kids = profiles.filter((p) => p.kids).length;
  return kids ? `${kids} kids profile${kids === 1 ? "" : "s"}` : "Profiles";
}

function TypeCard({
  active,
  onClick,
  title,
  subtitle,
  emoji,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  emoji: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 text-left transition",
        active ? "border-[#e50914] bg-[#e50914]/10" : "border-white/12 bg-black/25 hover:border-white/30",
      )}
    >
      <span className="text-xl">{emoji}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">{title}</span>
        <span className="block text-[11px] leading-snug text-white/45">{subtitle}</span>
      </span>
    </button>
  );
}
