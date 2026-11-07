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

export type Profile = {
  id: string;
  name: string;
  gradient: string;
  emoji: string;
  /** kids profiles only see family-safe titles */
  kids: boolean;
};

/** Avatar presets offered on the profile screen. */
export const AVATARS: Array<{ emoji: string; gradient: string }> = [
  { emoji: "🍿", gradient: "from-[#e50914] via-[#7f1d1d] to-[#1a1a1a]" },
  { emoji: "🎬", gradient: "from-[#2563eb] via-[#1e3a8a] to-[#0b1120]" },
  { emoji: "🦸", gradient: "from-[#f59e0b] via-[#b45309] to-[#1a1206]" },
  { emoji: "👽", gradient: "from-[#22c55e] via-[#15803d] to-[#04150a]" },
  { emoji: "🐉", gradient: "from-[#a855f7] via-[#6b21a8] to-[#12021f]" },
  { emoji: "🎧", gradient: "from-[#06b6d4] via-[#0e7490] to-[#04121a]" },
  { emoji: "👾", gradient: "from-[#ec4899] via-[#9d174d] to-[#1a0410]" },
  { emoji: "🐼", gradient: "from-[#f472b6] via-[#be185d] to-[#20040f]" },
  { emoji: "🧑‍🚀", gradient: "from-[#64748b] via-[#334155] to-[#0b1018]" },
  { emoji: "🦊", gradient: "from-[#fb923c] via-[#c2410c] to-[#1a0a03]" },
];

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
  addProfile: (input: Omit<Profile, "id">) => Profile;
  removeProfile: (id: string) => void;
  myList: string[];
  inList: (slug: string) => boolean;
  toggleList: (slug: string) => void;
  progress: Record<string, WatchProgress>;
  setProgress: (slug: string, value: WatchProgress) => void;
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [profiles, setProfilesState] = useState<Profile[]>([]);
  const [myList, setMyList] = useState<string[]>([]);
  const [progress, setProgressState] = useState<Record<string, WatchProgress>>({});
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [splash, setSplash] = useState(false);
  const toastId = useRef(0);

  useEffect(() => {
    const savedProfile = read<Profile | null>("nf.profile", null);
    setProfileState(savedProfile);
    /* the title card animation runs on every visit, not just the first one */
    if (savedProfile) setSplash(true);
    setProfilesState(read<Profile[]>("nf.profiles", []));
    setMyList(read<string[]>("nf.mylist", []));
    setProgressState(read<Record<string, WatchProgress>>("nf.progress", {}));
    setHydrated(true);
  }, []);

  const setProfile = useCallback((p: Profile | null) => {
    setProfileState(p);
    write("nf.profile", p);
  }, []);

  const addProfile = useCallback((input: Omit<Profile, "id">) => {
    const created: Profile = { ...input, id: `p_${Date.now().toString(36)}` };
    setProfilesState((current) => {
      const next = [...current, created];
      write("nf.profiles", next);
      return next;
    });
    return created;
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

  const toggleList = useCallback(
    (slug: string) => {
      setMyList((current) => {
        const has = current.includes(slug);
        const next = has ? current.filter((s) => s !== slug) : [slug, ...current];
        write("nf.mylist", next);
        return next;
      });
    },
    [],
  );

  const inList = useCallback((slug: string) => myList.includes(slug), [myList]);

  const setProgress = useCallback((slug: string, value: WatchProgress) => {
    setProgressState((current) => {
      const next = { ...current, [slug]: value };
      write("nf.progress", next);
      return next;
    });
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
      removeProfile,
      myList,
      inList,
      toggleList,
      progress,
      setProgress,
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
      removeProfile,
      myList,
      inList,
      toggleList,
      progress,
      setProgress,
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


