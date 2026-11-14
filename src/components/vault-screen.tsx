"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/store";
import { cn } from "@/lib/cn";
import type { VaultFeed, VaultItem } from "@/lib/vault-types";

/**
 * The 18+ vault screen.
 *
 * The server already proved the visitor knows the PIN, but the PIN is per
 * browser while maturity is per profile — a kid can sit down at an unlocked
 * device. So the first thing this does is re-check the active profile and
 * revoke the session if it is not an All-maturity adult profile.
 */
export function VaultScreen() {
  const router = useRouter();
  const { profile } = useStore();
  const [state, setState] = useState<"checking" | "ready" | "locked" | "denied">("checking");
  const [feed, setFeed] = useState<VaultFeed | null>(null);
  const [tag, setTag] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<VaultItem | null>(null);

  const adult = Boolean(profile && !profile.kids && profile.maturity === "all");

  /* the store hydrates from localStorage after mount, so wait one tick */
  useEffect(() => {
    const timer = setTimeout(() => setState(adult ? "ready" : "denied"), 350);
    return () => clearTimeout(timer);
  }, [adult]);

  useEffect(() => {
    if (state !== "denied") return;
    void fetch("/api/vault", { method: "DELETE" }).catch(() => undefined);
    const timer = setTimeout(() => router.replace("/"), 1800);
    return () => clearTimeout(timer);
  }, [state, router]);

  useEffect(() => {
    if (state !== "ready") return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/vault", { cache: "no-store" });
        if (res.status === 401) {
          if (alive) setState("locked");
          return;
        }
        const payload = (await res.json()) as VaultFeed & { error?: string };
        if (alive) setFeed(payload);
      } catch {
        if (alive) setFeed({ items: [], configured: true, error: "could not reach the vault" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [state]);

  const lock = useCallback(async () => {
    await fetch("/api/vault", { method: "DELETE" }).catch(() => undefined);
    router.replace("/settings?tab=privacy");
  }, [router]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of feed?.items ?? []) {
      for (const name of item.tags) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([name]) => name);
  }, [feed]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (feed?.items ?? []).filter((item) => {
      if (tag !== "all" && !item.tags.includes(tag)) return false;
      if (!needle) return true;
      return `${item.title} ${item.tags.join(" ")}`.toLowerCase().includes(needle);
    });
  }, [feed, tag, query]);

  if (state === "denied") {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ff5c5c]">Restricted</p>
          <h1 className="mt-2 font-display text-2xl text-white">This profile cannot open the vault</h1>
          <p className="mt-2 text-[13px] text-white/45">Closing the 18+ session…</p>
        </div>
      </main>
    );
  }

  if (state === "checking" || (state === "ready" && !feed)) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="animate-pulse text-[13px] text-white/40">Opening the vault…</p>
      </main>
    );
  }

  if (state === "locked") {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-display text-2xl text-white">Vault locked</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/45">
            The 45-minute session has ended. Unlock it again from Settings → Privacy &amp; data.
          </p>
          <Link
            href="/settings?tab=privacy"
            className="mt-5 inline-block rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-white/85"
          >
            Back to settings
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 md:px-8">
          <Link href="/" className="font-display text-[18px] tracking-[0.2em] text-white">
            NOFLIX
          </Link>
          <span className="rounded border border-[#ff5c5c]/50 bg-[#ff5c5c]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ff8080]">
            18+ only
          </span>
          <div className="ml-auto flex items-center gap-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the vault"
              aria-label="Search the vault"
              className="w-36 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[13px] text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none sm:w-56"
            />
            <button
              type="button"
              onClick={() => void lock()}
              className="rounded-md border border-white/20 px-3 py-1.5 text-[12.5px] text-white/75 transition hover:border-white hover:text-white"
            >
              Lock
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ff5c5c]">Adults only · 18+</p>
        <h1 className="mt-1 font-display text-[clamp(1.7rem,4vw,2.6rem)] leading-none text-white">The vault</h1>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/40">
          Separate from the catalogue on purpose. Nothing here appears in search, shelves or the home page, and the
          session dies on its own after 45 minutes.
        </p>

        {tags.length > 0 && (
          <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
            {["all", ...tags].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setTag(name)}
                aria-pressed={tag === name}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[12px] capitalize transition",
                  tag === name
                    ? "border-[#ff5c5c] bg-[#ff5c5c]/15 text-white"
                    : "border-white/15 text-white/55 hover:border-white/35 hover:text-white",
                )}
              >
                {name === "all" ? "Everything" : name}
              </button>
            ))}
          </div>
        )}

        {feed?.error && (
          <p className="mt-5 rounded-lg border border-[#ffb44d]/30 bg-[#ffb44d]/10 px-3 py-2 text-[12.5px] text-[#ffcf94]">
            {feed.error}
          </p>
        )}

        {!feed?.configured && <NotConfigured />}

        {feed?.configured && visible.length === 0 && !feed.error && (
          <p className="mt-8 text-[13px] text-white/40">
            {feed.items.length === 0 ? "The feed is connected but returned no plays." : "Nothing matches that filter."}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPlaying(item)}
              className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] text-left transition hover:border-white/30"
            >
              <span className="relative block aspect-[16/10] overflow-hidden bg-black">
                {item.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.poster}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-[1.03] group-hover:opacity-100"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-[11px] text-white/30">No artwork</span>
                )}
                <span className="absolute right-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-[#ff8080]">
                  {item.rating ?? "18+"}
                </span>
                {item.duration && (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] text-white/85">
                    {item.duration}
                  </span>
                )}
              </span>
              <span className="block px-2.5 py-2">
                <span className="line-clamp-1 block text-[12.5px] font-medium text-white">{item.title}</span>
                <span className="mt-0.5 line-clamp-1 block text-[11px] capitalize text-white/35">
                  {item.year ? `${item.year} · ` : ""}
                  {item.tags.slice(0, 2).join(" · ")}
                </span>
              </span>
            </button>
          ))}
        </div>
      </main>

      {playing && <VaultPlayer item={playing} onClose={() => setPlaying(null)} />}
    </>
  );
}

function NotConfigured() {
  return (
    <div className="mt-6 rounded-lg border border-white/12 bg-white/[0.03] p-4 text-[12.5px] leading-relaxed text-white/50">
      <p className="font-semibold text-white/80">No feed connected yet</p>
      <p className="mt-1">
        Set <code className="rounded bg-white/10 px-1 py-0.5 text-[11.5px] text-white/80">VAULT_FEED_URL</code> (and
        optionally <code className="rounded bg-white/10 px-1 py-0.5 text-[11.5px] text-white/80">VAULT_FEED_KEY</code>)
        to a JSON index of streams from your provider. NOFLIX stores no adult media itself.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- player */

function VaultPlayer({ item, onClose }: { item: VaultItem; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let destroy: (() => void) | undefined;

    const isHls = /\.m3u8(\?|$)/i.test(item.stream);
    if (isHls && !video.canPlayType("application/vnd.apple.mpegurl")) {
      void (async () => {
        try {
          const { default: Hls } = await import("hls.js");
          if (!Hls.isSupported()) {
            setError("This browser cannot play that stream.");
            return;
          }
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hls.loadSource(item.stream);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) setError("That stream would not load.");
          });
          destroy = () => hls.destroy();
        } catch {
          setError("Player failed to start.");
        }
      })();
    } else {
      video.src = item.stream;
    }

    void video.play().catch(() => undefined);
    return () => {
      destroy?.();
      video.removeAttribute("src");
      video.load();
    };
  }, [item]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/95 p-3 md:p-8" role="dialog" aria-modal="true">
      <div className="w-full max-w-5xl">
        <div className="mb-2 flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">
            {item.title}
            <span className="ml-2 rounded bg-[#ff5c5c]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#ff8080]">
              {item.rating ?? "18+"}
            </span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/25 px-3 py-1.5 text-[12.5px] text-white/80 transition hover:border-white hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="relative overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            controls
            playsInline
            poster={item.poster}
            className="aspect-video w-full bg-black"
            onError={() => setError("That stream would not load.")}
          />
        </div>
        {error && <p className="mt-2 text-[12.5px] text-[#ff8080]">{error}</p>}
      </div>
    </div>
  );
}
