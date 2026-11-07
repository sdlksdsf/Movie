"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AvatarId, MaturityLevel } from "@/lib/avatars";
import { ACCENTS } from "@/lib/avatars";
import { isPlayerId, type PlayerId, type Quality } from "@/lib/players";

export type Profile = {
  id: string;
  name: string;
  avatar: AvatarId;
  /** tint behind the avatar + the profile's own accent colour */
  accent: string;
  /** kids profiles only see family-safe titles */
  kids: boolean;
  maturity: MaturityLevel;
  autoplay: boolean;
  createdAt: number;
};

export type Settings = {
  /** UI accent colour, drives buttons, focuses and highlights */
  accent: string;
  /** how big shelf cards render */
  density: "compact" | "cozy" | "large";
  hoverPreviews: boolean;
  reduceMotion: boolean;
  autoplayTrailers: boolean;
  /** lighter data: fewer live rows, smaller artwork */
  dataSaver: boolean;
  defaultPlayer: PlayerId;
  quality: Quality;
  autoplayNext: boolean;
  language: string;
  hideMature: boolean;
  /** anime servers play subbed or dubbed */
  animeAudio: "sub" | "dub";
};

export const DEFAULT_SETTINGS: Settings = {
  accent: ACCENTS[0].value,
  density: "cozy",
  hoverPreviews: true,
  reduceMotion: false,
  autoplayTrailers: true,
  dataSaver: false,
  defaultPlayer: "framex",
  quality: "1080p",
  autoplayNext: true,
  language: "English",
  hideMature: false,
  animeAudio: "sub",
};

export type WatchProgress = {
  season: number;
  episode: number;
  /** 0 – 1 */
  percent: number;
  /** playback position in seconds, used for `?t=` resumes */
  seconds?: number;
  /** total length in seconds */
  duration?: number;
  updated: number;
};

type Toast = { id: number; message: string };

type Store = {
  hydrated: boolean;
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  profiles: Profile[];
  addProfile: (input: Omit<Profile, "id" | "createdAt">) => Profile;
  updateProfile: (id: string, patch: Partial<Omit<Profile, "id">>) => void;
  removeProfile: (id: string) => void;
  myList: string[];
  inList: (slug: string) => boolean;
  toggleList: (slug: string) => void;
  progress: Record<string, WatchProgress>;
  setProgress: (slug: string, value: WatchProgress) => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  clearEverything: () => void;
  activeSlug: string | null;
  openTitle: (slug: string | null) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  toast: (message: string) => void;
  toasts: Toast[];
  splash: boolean;
  setSplash: (on: boolean) => void;
};

const StoreContext = createContext<Store | null>(null);

const read = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage might be full / disabled — ignore */
  }
};

const EMOJI_TO_AVATAR: Record<string, AvatarId> = {
  "🍿": "reel",
  "🎬": "reel",
  "🦸": "hero",
  "👽": "alien",
  "🐉": "dragon",
  "🎧": "ninja",
  "👾": "alien",
  "🐼": "panda",
  "🧑‍🚀": "astro",
  "🦊": "fox",
};

const MATURE: MaturityLevel[] = ["kids", "7", "13", "16", "all"];

/** Upgrades profiles saved by older builds (emoji + tailwind gradient). */
function migrateProfile(raw: Record<string, unknown>): Profile {
  const emoji = typeof raw.emoji === "string" ? raw.emoji : "";
  const gradient = typeof raw.gradient === "string" ? raw.gradient : "";
  const hex = gradient.match(/#[0-9a-f]{6}/i)?.[0] ?? ACCENTS[0].value;
  const maturity = MATURE.includes(raw.maturity as MaturityLevel)
    ? (raw.maturity as MaturityLevel)
    : raw.kids
      ? "kids"
      : "all";
  return {
    id: typeof raw.id === "string" ? raw.id : `p_${Math.random().toString(36).slice(2)}`,
    name: typeof raw.name === "string" ? raw.name : "Profile",
    avatar: (raw.avatar as AvatarId) ?? EMOJI_TO_AVATAR[emoji] ?? "robot",
    accent: typeof raw.accent === "string" ? raw.accent : hex,
    kids: Boolean(raw.kids) || maturity === "kids",
    maturity,
    autoplay: raw.autoplay === undefined ? true : Boolean(raw.autoplay),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [profiles, setProfilesState] = useState<Profile[]>([]);
  const [myList, setMyList] = useState<string[]>([]);
  const [progress, setProgressState] = useState<Record<string, WatchProgress>>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [splash, setSplash] = useState(false);
  const toastId = useRef(0);

  useEffect(() => {
    const storedProfiles = read<Record<string, unknown>[]>("nf.profiles", []).map(migrateProfile);
    const storedProfile = read<Record<string, unknown> | null>("nf.profile", null);

    setProfilesState(storedProfiles);
    const active = storedProfile ? migrateProfile(storedProfile) : null;
    setProfileState(active);
    /* the title card animation runs on every visit, not just the first one */
    if (active) setSplash(true);

    setMyList(read<string[]>("nf.mylist", []));
    setProgressState(read<Record<string, WatchProgress>>("nf.progress", {}));
    const storedSettings = read<Partial<Settings>>("nf.settings", {});
    if (!storedSettings.defaultPlayer) {
      const lastServer = window.localStorage.getItem("nf.player");
      if (lastServer && isPlayerId(lastServer)) storedSettings.defaultPlayer = lastServer;
    }
    setSettings({ ...DEFAULT_SETTINGS, ...storedSettings });
    setHydrated(true);
  }, []);

  /* keep the document in sync with the chosen look */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--nf-accent", settings.accent);
    root.dataset.density = settings.density;
    root.dataset.motion = settings.reduceMotion ? "off" : "on";
    root.dataset.saver = settings.dataSaver ? "on" : "off";
    root.dataset.hover = settings.hoverPreviews ? "on" : "off";
    root.dataset.kids = profile?.kids ? "on" : "off";

    /* the player reads these plain (unquoted) keys on mount */
    try {
      window.localStorage.setItem("nf.player", settings.defaultPlayer);
      window.localStorage.setItem("nf.quality", settings.quality);
    } catch {
      /* ignore */
    }
  }, [settings, profile?.kids]);

  const setProfile = useCallback((p: Profile | null) => {
    setProfileState(p);
    write("nf.profile", p);
  }, []);

  const addProfile = useCallback((input: Omit<Profile, "id" | "createdAt">) => {
    const created: Profile = { ...input, id: `p_${Date.now().toString(36)}`, createdAt: Date.now() };
    setProfilesState((current) => {
      const next = [...current, created];
      write("nf.profiles", next);
      return next;
    });
    return created;
  }, []);

  const updateProfile = useCallback((id: string, patch: Partial<Omit<Profile, "id">>) => {
    setProfilesState((current) => {
      const next = current.map((p) => (p.id === id ? { ...p, ...patch } : p));
      write("nf.profiles", next);
      return next;
    });
    setProfileState((current) => {
      if (current?.id !== id) return current;
      const next = { ...current, ...patch };
      write("nf.profile", next);
      return next;
    });
  }, []);

  const removeProfile = useCallback((id: string) => {
    setProfilesState((current) => {
      const next = current.filter((p) => p.id !== id);
      write("nf.profiles", next);
      return next;
    });
    setProfileState((current) => {
      if (current?.id !== id) return current;
      write("nf.profile", null);
      return null;
    });
  }, []);

  const toggleList = useCallback((slug: string) => {
    setMyList((current) => {
      const has = current.includes(slug);
      const next = has ? current.filter((s) => s !== slug) : [slug, ...current];
      write("nf.mylist", next);
      return next;
    });
  }, []);

  const inList = useCallback((slug: string) => myList.includes(slug), [myList]);

  const setProgress = useCallback((slug: string, value: WatchProgress) => {
    setProgressState((current) => {
      const next = { ...current, [slug]: value };
      write("nf.progress", next);
      return next;
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      write("nf.settings", next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    write("nf.settings", DEFAULT_SETTINGS);
  }, []);

  const clearEverything = useCallback(() => {
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("nf.")) window.localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
    setProfilesState([]);
    setProfileState(null);
    setMyList([]);
    setProgressState({});
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const toast = useCallback((message: string) => {
    const id = ++toastId.current;
    setToasts((current) => [...current, { id, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  /** Lock body scroll while a modal / gate is open. */
  useEffect(() => {
    const locked = Boolean(activeSlug) || searchOpen;
    document.body.style.overflow = locked ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeSlug, searchOpen]);

  /** Global keyboard shortcut: "/" opens search, Esc closes things. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (!typing && (event.key === "/" || (event.key === "k" && (event.metaKey || event.ctrlKey)))) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setActiveSlug(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<Store>(
    () => ({
      hydrated,
      profile,
      setProfile,
      profiles,
      addProfile,
      updateProfile,
      removeProfile,
      myList,
      inList,
      toggleList,
      progress,
      setProgress,
      settings,
      updateSettings,
      resetSettings,
      clearEverything,
      activeSlug,
      openTitle: setActiveSlug,
      searchOpen,
      setSearchOpen,
      toast,
      toasts,
      splash,
      setSplash,
    }),
    [
      hydrated,
      profile,
      setProfile,
      profiles,
      addProfile,
      updateProfile,
      removeProfile,
      myList,
      inList,
      toggleList,
      progress,
      setProgress,
      settings,
      updateSettings,
      resetSettings,
      clearEverything,
      activeSlug,
      searchOpen,
      toast,
      toasts,
      splash,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
