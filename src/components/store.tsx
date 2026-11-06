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
};

export type WatchProgress = {
  season: number;
  episode: number;
  /** 0 – 1 */
  percent: number;
  updated: number;
};

type Toast = { id: number; message: string };

type Store = {
  hydrated: boolean;
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
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
  const [myList, setMyList] = useState<string[]>([]);
  const [progress, setProgressState] = useState<Record<string, WatchProgress>>({});
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [splash, setSplash] = useState(false);
  const toastId = useRef(0);

  useEffect(() => {
    setProfileState(read<Profile | null>("nf.profile", null));
    setMyList(read<string[]>("nf.mylist", []));
    setProgressState(read<Record<string, WatchProgress>>("nf.progress", {}));
    setHydrated(true);
  }, []);

  const setProfile = useCallback((p: Profile | null) => {
    setProfileState(p);
    write("nf.profile", p);
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

export const profiles: Profile[] = [
  { id: "p1", name: "You", gradient: "from-[#e50914] via-[#7f1d1d] to-[#1a1a1a]", emoji: "🍿" },
  { id: "p2", name: "Binge Buddy", gradient: "from-[#2563eb] via-[#1e3a8a] to-[#0b1120]", emoji: "🎬" },
  { id: "p3", name: "Movie Buff", gradient: "from-[#f59e0b] via-[#b45309] to-[#1a1206]", emoji: "⭐" },
  { id: "p4", name: "Kids", gradient: "from-[#22c55e] via-[#15803d] to-[#06170c]", emoji: "🧸" },
];
