"use client";

import { useMemo, useState } from "react";
import { ProfileAvatar } from "@/components/avatar";
import { useStore, type Profile } from "@/components/store";
import { Wordmark } from "@/components/wordmark";
import { CheckIcon, CloseIcon, PlusIcon } from "@/components/icons";
import { ACCENTS, AVATARS, MATURITY, type AvatarId, type MaturityLevel } from "@/lib/avatars";
import { cn } from "@/lib/cn";

type Draft = {
  name: string;
  avatar: AvatarId;
  accent: string;
  maturity: MaturityLevel;
  autoplay: boolean;
};

const emptyDraft: Draft = {
  name: "",
  avatar: "robot",
  accent: ACCENTS[0].value,
  maturity: "all",
  autoplay: true,
};

/**
 * Entry experience: create an account the first time, then pick a profile.
 * Profiles are fully customizable — character, colour, maturity level, autoplay
 * — and kids profiles only ever see family-safe titles.
 */
export function ProfileGate({ onPick }: { onPick: (profile: Profile) => void }) {
  const { profiles, addProfile, updateProfile, removeProfile } = useStore();
  const [mode, setMode] = useState<"pick" | "edit" | "manage">(profiles.length ? "pick" : "edit");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [step, setStep] = useState(0);

  const kids = draft.maturity === "kids" || draft.maturity === "7";
  const active = profiles.find((p) => p.id === editing) ?? null;

  const startNew = () => {
    setDraft(emptyDraft);
    setEditing(null);
    setStep(0);
    setMode("edit");
  };

  const startEdit = (profile: Profile) => {
    setDraft({
      name: profile.name,
      avatar: profile.avatar,
      accent: profile.accent,
      maturity: profile.maturity,
      autoplay: profile.autoplay,
    });
    setEditing(profile.id);
    setStep(0);
    setMode("edit");
  };

  const save = () => {
    const label = draft.name.trim() || (kids ? "Kids" : "You");
    const payload = {
      name: label.slice(0, 18),
      avatar: draft.avatar,
      accent: draft.accent,
      maturity: draft.maturity,
      kids: draft.maturity === "kids",
      autoplay: draft.autoplay,
    };
    if (active) {
      updateProfile(active.id, payload);
      onPick({ ...active, ...payload });
    } else {
      const created = addProfile(payload);
      onPick(created);
    }
  };

  const chosenMaturity = useMemo(
    () => MATURITY.find((entry) => entry.id === draft.maturity) ?? MATURITY[4],
    [draft.maturity],
  );

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#0b0b0b] no-scrollbar">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-40 top-[-22%] h-[70vh] w-[70vh] rounded-full opacity-40 blur-[130px]"
          style={{ background: draft.accent }}
        />
        <div className="absolute -right-32 bottom-[-30%] h-[60vh] w-[60vh] rounded-full bg-[#3b0d0f] opacity-60 blur-[130px]" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_18%,#080808_78%)]" />
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-[1180px] flex-col px-5 py-6 md:px-10 md:py-8">
        <header className="flex items-center justify-between gap-3">
          <Wordmark className="text-2xl md:text-3xl" />
          <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white/45">
            {profiles.length ? `${profiles.length} profile${profiles.length === 1 ? "" : "s"}` : "Get started"}
          </span>
        </header>

        <div className="flex flex-1 flex-col justify-center py-8">
          {mode === "edit" ? (
            <div className="mx-auto w-full max-w-[1000px]">
              <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-[var(--nf-accent)]">
                {active ? "Edit profile" : profiles.length ? "New profile" : "Welcome to NOFLIX"}
              </p>
              <h1 className="mb-6 font-display text-3xl tracking-wide text-white sm:text-4xl md:text-5xl">
                {active ? "Make it yours" : profiles.length ? "Add a profile" : "Create your account"}
              </h1>

              <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
                {/* live preview */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
                  <ProfileAvatar
                    avatar={draft.avatar}
                    accent={draft.accent}
                    rounded="rounded-2xl"
                    className="mx-auto aspect-square w-full max-w-[190px]"
                    kids={draft.maturity === "kids"}
                  />
                  <p className="mt-4 truncate font-display text-xl tracking-wide text-white">
                    {draft.name.trim() || (kids ? "Kids" : "Your name")}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/40">
                    {chosenMaturity.label} · {draft.autoplay ? "Autoplay on" : "Autoplay off"}
                  </p>
                  {draft.maturity === "kids" && (
                    <p className="mt-3 rounded-lg bg-[#22c55e]/15 px-3 py-2 text-[11px] leading-snug text-[#86efac]">
                      Kids space: cartoons, family films and nothing scary. Mature titles are hidden
                      everywhere — shelves, search and the catalogue.
                    </p>
                  )}
                </div>

                {/* controls */}
                <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:p-6">
                  <div>
                    <Label>Profile name</Label>
                    <input
                      value={draft.name}
                      onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
                      onKeyDown={(event) => event.key === "Enter" && save()}
                      maxLength={18}
                      placeholder={kids ? "Kids" : "Your name"}
                      className="w-full rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-base text-white outline-none transition placeholder:text-white/30 focus:border-[var(--nf-accent)]"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <Label className="mb-0">Character</Label>
                      <span className="text-[11px] text-white/35">{AVATARS.length} to choose from</span>
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {AVATARS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, avatar: option.id }))}
                          aria-label={option.label}
                          title={option.label}
                          className={cn(
                            "relative aspect-square overflow-hidden rounded-lg transition",
                            draft.avatar === option.id
                              ? "ring-2 ring-white ring-offset-2 ring-offset-[#141414]"
                              : "opacity-75 hover:opacity-100",
                          )}
                        >
                          <ProfileAvatar
                            avatar={option.id}
                            accent={draft.accent}
                            rounded="rounded-lg"
                            className="h-full w-full"
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Colour</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {ACCENTS.map((colour) => (
                        <button
                          key={colour.id}
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, accent: colour.value }))}
                          title={colour.label}
                          aria-label={colour.label}
                          className={cn(
                            "h-7 w-7 rounded-full transition",
                            draft.accent === colour.value
                              ? "ring-2 ring-white ring-offset-2 ring-offset-[#141414]"
                              : "opacity-85 hover:opacity-100",
                          )}
                          style={{ background: colour.value }}
                        />
                      ))}
                      <label className="ml-1 inline-flex h-7 cursor-pointer items-center gap-2 rounded-full border border-white/20 px-3 text-[11px] text-white/60 transition hover:border-white/50 hover:text-white">
                        Custom
                        <input
                          type="color"
                          value={draft.accent}
                          onChange={(event) => setDraft((d) => ({ ...d, accent: event.target.value }))}
                          className="h-4 w-4 cursor-pointer rounded-full border-0 bg-transparent p-0"
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <Label className="mb-0">Maturity level</Label>
                      <span className="text-[11px] text-white/35">{chosenMaturity.hint}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {MATURITY.map((level) => (
                        <button
                          key={level.id}
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, maturity: level.id }))}
                          className={cn(
                            "rounded-lg border px-1 py-2 text-[11px] font-medium transition",
                            draft.maturity === level.id
                              ? "border-white bg-white text-black"
                              : "border-white/15 text-white/65 hover:border-white/40 hover:text-white",
                          )}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-white">Autoplay previews</p>
                      <p className="text-[11px] text-white/40">Trailers start by themselves on this profile</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.autoplay}
                      onClick={() => setDraft((d) => ({ ...d, autoplay: !d.autoplay }))}
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition",
                        draft.autoplay ? "bg-[var(--nf-accent)]" : "bg-white/20",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                          draft.autoplay ? "left-[22px]" : "left-0.5",
                        )}
                      />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    {profiles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode(step === 0 ? "pick" : "pick");
                          setEditing(null);
                        }}
                        className="rounded-md px-4 py-3 text-sm text-white/60 transition hover:text-white"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={save}
                      className="flex-1 rounded-md bg-[var(--nf-accent)] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.99]"
                    >
                      {active ? "Save profile" : kids ? "Start kids space" : "Start watching"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full">
              <h1 className="mb-2 text-center font-display text-3xl tracking-wide sm:text-4xl md:text-5xl">
                Who&apos;s watching?
              </h1>
              <p className="mb-9 text-center text-sm text-white/45">
                {mode === "manage"
                  ? "Tap a profile to edit it"
                  : "Pick a profile — or add someone new"}
              </p>

              <div className="flex flex-wrap items-start justify-center gap-5 md:gap-7">
                {profiles.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => (mode === "manage" ? startEdit(item) : onPick(item))}
                    className="group flex w-[92px] flex-col items-center gap-2.5 md:w-[118px]"
                  >
                    <span className="relative block aspect-square w-full transition duration-200 group-hover:scale-[1.04] group-active:scale-[0.98]">
                      <ProfileAvatar
                        avatar={item.avatar}
                        accent={item.accent}
                        rounded="rounded-xl"
                        className="h-full w-full ring-2 ring-transparent transition group-hover:ring-white"
                        kids={item.maturity === "kids"}
                      />
                      {mode === "manage" && (
                        <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/55 text-white">
                          <PencilIcon />
                        </span>
                      )}
                    </span>
                    <span className="max-w-full truncate text-[13px] text-white/60 transition group-hover:text-white">
                      {item.name}
                    </span>
                  </button>
                ))}

                {profiles.length < 5 && (
                  <button
                    type="button"
                    onClick={startNew}
                    className="group flex w-[92px] flex-col items-center gap-2.5 md:w-[118px]"
                  >
                    <span className="grid aspect-square w-full place-items-center rounded-xl border-2 border-dashed border-white/25 text-white/50 transition group-hover:border-white group-hover:text-white">
                      <PlusIcon width={26} height={26} />
                    </span>
                    <span className="text-[13px] text-white/60 transition group-hover:text-white">
                      Add profile
                    </span>
                  </button>
                )}
              </div>

              <div className="mt-11 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setMode(mode === "manage" ? "pick" : "manage")}
                  className="border border-white/25 px-6 py-2 text-[11px] uppercase tracking-[0.22em] text-white/60 transition hover:border-white hover:text-white"
                >
                  {mode === "manage" ? "Done" : "Manage profiles"}
                </button>
              </div>

              {mode === "manage" && (
                <div className="mx-auto mt-6 max-w-md space-y-2">
                  {profiles.map((item) => (
                    <div
                      key={`row-${item.id}`}
                      className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                    >
                      <ProfileAvatar
                        avatar={item.avatar}
                        accent={item.accent}
                        className="h-8 w-8"
                        rounded="rounded-md"
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-white/80">
                        {item.name}
                        <span className="ml-2 text-[11px] text-white/35">
                          {MATURITY.find((m) => m.id === item.maturity)?.label}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="rounded px-2 py-1 text-[11px] uppercase tracking-wider text-white/60 hover:text-white"
                      >
                        Edit
                      </button>
                      {profiles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProfile(item.id)}
                          aria-label={`Delete ${item.name}`}
                          className="rounded p-1 text-white/40 transition hover:text-[#ff5c5c]"
                        >
                          <CloseIcon width={14} height={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="pb-2 text-center text-[11px] text-white/25">
          NOFLIX · profiles, My List and progress stay on this device
        </footer>
      </div>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45",
        className,
      )}
    >
      {children}
    </p>
  );
}

function PencilIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProfileSwatches() {
  const { profile, updateProfile } = useStore();
  if (!profile) return null;
  return (
    <div className="flex gap-2">
      {ACCENTS.slice(0, 8).map((colour) => (
        <button
          key={colour.id}
          type="button"
          aria-label={colour.label}
          onClick={() => updateProfile(profile.id, { accent: colour.value })}
          className="h-6 w-6 rounded-full ring-offset-2 ring-offset-[#141414] transition hover:ring-2 hover:ring-white"
          style={{ background: colour.value }}
        />
      ))}
    </div>
  );
}

export { CheckIcon };
