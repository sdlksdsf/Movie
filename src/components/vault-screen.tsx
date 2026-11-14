"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/store";
import { cn } from "@/lib/cn";
import type { VaultFeed, VaultItem } from "@/lib/vault-types";
import { VAULT_CATEGORIES, VAULT_COUNTRIES, facetFor } from "@/lib/vault-taxonomy";

/**
 * The 18+ vault screen.
 *
 * The server already proved the visitor knows the PIN, but the PIN is per
 * browser while maturity is per profile — a kid can sit down at an unlocked
 * device. So the first thing this does is re-check the active profile and
 * revoke the session if it is not an All-maturity adult profile.
 *
 * Search and both rails are *server-side*: typing or picking a facet re-queries
 * `/api/vault`, so you can find anything the provider has rather than only what
 * happens to be in the first page of results already in the browser.
 */
export function VaultScreen() {
  const router = useRouter();
  const { profile } = useStore();
  const [state, setState] = useState<"checking" | "ready" | "locked" | "denied">("checking");
  const [feed, setFeed] = useState<VaultFeed | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string>("");
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

  /* one request pipeline for the initial load, the search box and the rails */
  useEffect(() => {
    if (state !== "ready") return;
    const controller = new AbortController();
    const delay = query.trim().length > 0 ? 320 : 0;

    const timer = setTimeout(() => {
      setLoading(true);
      void (async () => {
        try {
          const params = new URLSearchParams();
          if (query.trim()) params.set("q", query.trim());
          if (tag) params.set("tag", tag);
          const res = await fetch(`/api/vault${params.size ? `?${params}` : ""}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (res.status === 401) {
            setState("locked");
            return;
          }
          const payload = (await res.json()) as VaultFeed;
          setFeed(payload);
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            setFeed({ items: [], configured: true, error: "could not reach the vault" });
          }
        } finally {
          setLoading(false);
        }
      })();
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [state, query, tag]);

  const lock = useCallback(async () => {
    await fetch("/api/vault", { method: "DELETE" }).catch(() => undefined);
    router.replace("/settings?tab=privacy");
  }, [router]);

  const activeFacet = useMemo(() => facetFor(tag), [tag]);
  const country = useMemo(() => VAULT_COUNTRIES.find((entry) => entry.id === tag), [tag]);
  const items = feed?.items ?? [];

  const pick = (id: string) => {
    setTag(id);
    setQuery("");
  };

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

  if (state === "checking" || (state === "ready" && !feed && loading)) {
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
            <div className="relative">
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setTag("");
                }}
                type="search"
                placeholder="Search the vault"
                aria-label="Search the vault"
                className="w-40 rounded-md border border-white/15 bg-white/5 py-1.5 pl-8 pr-3 text-[13px] text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none sm:w-64"
              />
              <span aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-white/40">
                🔍
              </span>
            </div>
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
        <h1 className="mt-1 font-display text-[clamp(1.7rem,4vw,2.6rem)] leading-none text-white">
          {country ? `From ${country.emoji} ${country.label}` : activeFacet ? activeFacet.label : "The vault"}
        </h1>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/40">
          Separate from the catalogue on purpose. Nothing here appears in search, shelves or the home page, and the
          session dies on its own after 45 minutes.
        </p>

        {/* categories — one provider search term each, resolved server-side */}
        <section className="mt-6">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Categories</h2>
            {tag && (
              <button
                type="button"
                onClick={() => pick("")}
                className="text-[11px] text-[#ff8080] underline-offset-4 hover:underline"
              >
                clear
              </button>
            )}
          </div>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
            {VAULT_CATEGORIES.map((facet) => (
              <button
                key={facet.id}
                type="button"
                onClick={() => pick(facet.id)}
                aria-pressed={tag === facet.id}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition",
                  tag === facet.id
                    ? "border-[#ff5c5c] bg-[#ff5c5c]/15 text-white"
                    : "border-white/15 text-white/55 hover:border-white/35 hover:text-white",
                )}
              >
                <span aria-hidden className="mr-1">
                  {facet.emoji}
                </span>
                {facet.label}
              </button>
            ))}
          </div>
        </section>

        {/* country rail — these are provider tags, not a real geo filter */}
        <section className="mt-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            From each country
          </h2>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
            {VAULT_COUNTRIES.map((facet) => (
              <button
                key={facet.id}
                type="button"
                onClick={() => pick(facet.id)}
                aria-pressed={tag === facet.id}
                title={`Titles tagged “${facet.term}” by the provider`}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition",
                  tag === facet.id
                    ? "border-[#ff5c5c] bg-[#ff5c5c]/15 text-white"
                    : "border-white/15 text-white/55 hover:border-white/35 hover:text-white",
                )}
              >
                <span aria-hidden className="mr-1.5">
                  {facet.emoji}
                </span>
                {facet.label}
              </button>
            ))}
          </div>
        </section>

        {(query.trim() || activeFacet) && (
          <p className="mt-5 text-[12px] text-white/40">
            {loading ? "Searching…" : `${items.length} ${items.length === 1 ? "result" : "results"}`}
            {query.trim() && (
              <>
                {" "}
                for <span className="text-white/70">“{query.trim()}”</span>
              </>
            )}
            {activeFacet && !query.trim() && (
              <>
                {" "}
                tagged <span className="text-white/70">“{activeFacet.term}”</span>
              </>
            )}
          </p>
        )}

        {feed?.error && (
          <div className="mt-5 rounded-lg border border-[#ffb44d]/30 bg-[#ffb44d]/10 px-3 py-2 text-[12.5px] leading-relaxed text-[#ffcf94]">
            <p>{feed.error}</p>
            <p className="mt-1 text-[11.5px] text-[#ffcf94]/70">
              If the provider keeps refusing, some hosts block server-side requests. Point{" "}
              <code className="text-[#ffcf94]">VAULT_PROVIDER=custom</code> at your own feed, or try{" "}
              <code className="text-[#ffcf94]">VAULT_ORDER=latest</code>.
            </p>
          </div>
        )}

        {!feed?.configured && <NotConfigured />}

        {feed?.configured && !feed.error && items.length === 0 && !loading && (
          <p className="mt-8 text-[13px] text-white/40">
            {query.trim() || activeFacet
              ? "Nothing matched that. Try a broader word, or another category."
              : "The provider is connected but returned no plays."}
          </p>
        )}

        <div
          className={cn(
            "mt-6 grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6",
            loading && "opacity-50",
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPlaying(item)}
              className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] text-left transition hover:border-white/30"
            >
              {/* provider thumbnails are portrait (201×360), so the card is too */}
              <span className="relative block aspect-[3/4] overflow-hidden bg-black">
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
                  {item.tags.slice(0, 3).join(" · ") || (item.source ?? "18+")}
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
      <p className="font-semibold text-white/80">No provider connected</p>
      <p className="mt-1">
        Leave <code className="rounded bg-white/10 px-1 py-0.5 text-[11.5px] text-white/80">VAULT_PROVIDER</code> unset
        (or <code className="rounded bg-white/10 px-1 py-0.5 text-[11.5px] text-white/80">eporner</code>) to embed
        Eporner&apos;s public catalogue, or set it to{" "}
        <code className="rounded bg-white/10 px-1 py-0.5 text-[11.5px] text-white/80">custom</code> plus{" "}
        <code className="rounded bg-white/10 px-1 py-0.5 text-[11.5px] text-white/80">VAULT_FEED_URL</code> to use
        your own JSON index. NOFLIX hosts no adult media — playback always happens on the provider&apos;s side.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- player */

function VaultPlayer({ item, onClose }: { item: VaultItem; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * Embed items are played by the provider in their own iframe — NOFLIX never
   * touches those bytes, which is the whole point of the "we host nothing"
   * promise. Only when a source hands over a direct stream do we drive a
   * <video> element ourselves.
   */
  useEffect(() => {
    if (item.embed) return;
    const video = videoRef.current;
    const source = item.stream;
    if (!video || !source) return;
    let destroy: (() => void) | undefined;

    const isHls = /\.m3u8(\?|$)/i.test(source);
    if (isHls && !video.canPlayType("application/vnd.apple.mpegurl")) {
      void (async () => {
        try {
          const { default: Hls } = await import("hls.js");
          if (!Hls.isSupported()) {
            setError("This browser cannot play that stream.");
            return;
          }
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hls.loadSource(source);
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
      video.src = source;
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
          {item.embed ? (
            <iframe
              src={item.embed}
              title={item.title}
              className="aspect-video w-full bg-black"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
              allowFullScreen
            />
          ) : (
            <video
              ref={videoRef}
              controls
              playsInline
              poster={item.poster}
              className="aspect-video w-full bg-black"
              onError={() => setError("That stream would not load.")}
            />
          )}
        </div>
        {item.embed && (
          <p className="mt-2 text-[11.5px] text-white/35">
            Played by {item.source ?? "the provider"} in their own player. NOFLIX hosts nothing.
          </p>
        )}
        {error && <p className="mt-2 text-[12.5px] text-[#ff8080]">{error}</p>}
      </div>
    </div>
  );
}
