"use client";

import { useCallback, useEffect, useState } from "react";
import { TMDB_API_KEY } from "@/lib/tmdb-key";
import { cn } from "@/lib/cn";

type Status = "idle" | "checking" | "ok" | "warn" | "down";

type Check = {
  id: string;
  label: string;
  detail: string;
  status: Status;
  ms?: number;
  note?: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const REPO = "sdlksdsf/Movie";

const initial: Check[] = [
  { id: "tmdb", label: "TMDB API", detail: "Catalogue, artwork, trailers", status: "idle" },
  { id: "images", label: "TMDB image CDN", detail: "image.tmdb.org posters", status: "idle" },
  { id: "framex", label: "frameXTV", detail: "Primary stream server", status: "idle" },
  { id: "cinelite", label: "CineLite", detail: "Backup stream server", status: "idle" },
  { id: "rivestream", label: "RiveStream", detail: "Fallback stream server", status: "idle" },
  { id: "supabase", label: "Supabase", detail: "Profile + list sync", status: "idle" },
  { id: "jikan", label: "Jikan / MyAnimeList", detail: "Anime metadata", status: "idle" },
  { id: "tvmaze", label: "TVMaze", detail: "Episode metadata", status: "idle" },
  { id: "github", label: "GitHub repository", detail: REPO, status: "idle" },
];

async function timed(fn: () => Promise<{ ok: boolean; note?: string }>): Promise<{ status: Status; ms: number; note?: string }> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 9000);
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - started);
    return { status: result.ok ? "ok" : "down", ms, note: result.note };
  } catch (error) {
    const ms = Math.round(performance.now() - started);
    return { status: "down", ms, note: error instanceof Error ? error.message : "unreachable" };
  } finally {
    window.clearTimeout(timer);
  }
}

const json = async (url: string, headers?: Record<string, string>) => {
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const reachable = async (url: string) => {
  await fetch(url, { mode: "no-cors", cache: "no-store" });
  return true;
};

export function DeveloperPanel() {
  const [checks, setChecks] = useState<Check[]>(initial);
  const [running, setRunning] = useState(false);
  const [repo, setRepo] = useState<{
    stars: number;
    forks: number;
    issues: number;
    pushed: string;
    branch: string;
  } | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setChecks((current) => current.map((c) => ({ ...c, status: "checking" as Status })));

    const set = (id: string, patch: Partial<Check>) =>
      setChecks((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c)));

    const tasks: Array<Promise<void>> = [];

    tasks.push(
      (async () => {
        const r = await timed(() =>
          json(`https://api.themoviedb.org/3/configuration?api_key=${TMDB_API_KEY}`),
        );
        set("tmdb", { ...r, note: r.status === "ok" ? "key accepted" : "key rejected" });
      })(),
    );

    tasks.push(
      (async () => {
        const r = await timed(
          () =>
            new Promise<{ ok: boolean }>((resolve, reject) => {
              const img = new window.Image();
              const started = performance.now();
              img.onload = () => resolve({ ok: performance.now() - started < 8000 });
              img.onerror = () => reject(new Error("image failed"));
              img.src = "https://image.tmdb.org/t/p/w92/qJ2tW6WMUDux911r6m7haRef0WH.jpg";
            }),
        );
        set("images", r);
      })(),
    );

    for (const [id, url] of [
      ["framex", "https://framextv.cc/"],
      ["cinelite", "https://embed.cinelite.xyz/"],
      ["rivestream", "https://rivestream.ru/"],
    ] as const) {
      tasks.push(
        (async () => {
          const r = await timed(() => reachable(url).then((ok) => ({ ok })));
          set(id, { ...r, note: r.status === "ok" ? "reachable" : "no response" });
        })(),
      );
    }

    tasks.push(
      (async () => {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
          set("supabase", { status: "warn", ms: 0, note: "not configured" });
          return;
        }
        const r = await timed(async () => {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/app_state?select=device_id&limit=1`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
            cache: "no-store",
          });
          return { ok: res.ok || res.status === 401 || res.status === 403, note: `HTTP ${res.status}` };
        });
        set("supabase", r);
      })(),
    );

    tasks.push(
      (async () => {
        const r = await timed(() => json("https://api.jikan.moe/v4/anime/1"));
        set("jikan", r);
      })(),
    );

    tasks.push(
      (async () => {
        const r = await timed(() => json("https://api.tvmaze.com/shows/1"));
        set("tvmaze", r);
      })(),
    );

    tasks.push(
      (async () => {
        const r = await timed(async () => {
          const data = await json(`https://api.github.com/repos/${REPO}`, {
            Accept: "application/vnd.github+json",
          });
          setRepo({
            stars: data.stargazers_count ?? 0,
            forks: data.forks_count ?? 0,
            issues: data.open_issues_count ?? 0,
            pushed: data.pushed_at ?? "",
            branch: data.default_branch ?? "main",
          });
          return { ok: true, note: `${data.stargazers_count ?? 0} stars` };
        });
        set("github", r);
      })(),
    );

    await Promise.all(tasks);
    setRunning(false);
    setRanAt(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const okCount = checks.filter((c) => c.status === "ok").length;
  const downCount = checks.filter((c) => c.status === "down").length;
  const health = downCount === 0 ? "operational" : downCount < 3 ? "degraded" : "outage";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <span
              className={cn(
                "inline-block h-2.5 w-2.5 rounded-full",
                health === "operational"
                  ? "bg-[#46d369]"
                  : health === "degraded"
                    ? "bg-[#f5c518]"
                    : "bg-[#ff5c5c]",
              )}
            />
            All systems {health}
          </p>
          <p className="mt-1 text-[11.5px] text-white/40">
            {okCount}/{checks.length} services responding
            {ranAt ? ` · checked ${ranAt}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="rounded-md bg-white px-4 py-2 text-[12px] font-semibold text-black transition hover:bg-white/85 disabled:opacity-50"
        >
          {running ? "Checking…" : "Re-run checks"}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        {checks.map((check) => (
          <div
            key={check.id}
            className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 last:border-b-0"
          >
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                check.status === "ok" && "bg-[#46d369]",
                check.status === "warn" && "bg-[#f5c518]",
                check.status === "down" && "bg-[#ff5c5c]",
                check.status === "checking" && "animate-pulse bg-white/40",
                check.status === "idle" && "bg-white/15",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-white/90">{check.label}</p>
              <p className="truncate text-[11px] text-white/35">{check.note ?? check.detail}</p>
            </div>
            <span className="shrink-0 font-mono text-[11px] text-white/45">
              {check.ms !== undefined ? `${check.ms} ms` : "—"}
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Repository">
          {repo ? (
            <>
              <Row k="Stars" v={repo.stars.toLocaleString()} />
              <Row k="Forks" v={repo.forks.toLocaleString()} />
              <Row k="Open issues" v={repo.issues.toLocaleString()} />
              <Row k="Default branch" v={repo.branch} />
              <Row
                k="Last push"
                v={repo.pushed ? new Date(repo.pushed).toLocaleDateString() : "—"}
              />
              <a
                href={`https://github.com/${REPO}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-[12px] text-[var(--nf-accent)] hover:underline"
              >
                github.com/{REPO} →
              </a>
            </>
          ) : (
            <p className="text-[12px] text-white/40">Loading…</p>
          )}
        </Card>

        <Card title="This session">
          <Row k="Build" v={process.env.NEXT_PUBLIC_BUILD_ID ?? "local"} />
          <Row k="Built" v={formatBuildTime(process.env.NEXT_PUBLIC_BUILD_TIME)} />
          <Row
            k="Environment"
            v={
              process.env.NEXT_PUBLIC_VERCEL_ENV
                ? `Vercel · ${
                    { production: "production", preview: "preview" }[
                      process.env.NEXT_PUBLIC_VERCEL_ENV
                    ] ?? process.env.NEXT_PUBLIC_VERCEL_ENV
                  }`
                : "local"
            }
          />
          <Row k="Database sync" v={SUPABASE_URL ? "Supabase connected" : "local only"} />
          <Row k="Storage used" v={storageSize()} />
          <Row k="Online" v={typeof navigator !== "undefined" && navigator.onLine ? "yes" : "no"} />
          <Row k="Viewport" v={viewportLabel()} />
        </Card>
      </div>

      <p className="text-[11px] leading-relaxed text-white/30">
        Checks run from your browser, so they measure the path you actually use. Stream servers are
        probed for reachability only — playback itself happens inside their own player.
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-[12px] text-white/45">{k}</span>
      <span className="truncate font-mono text-[11.5px] text-white/80">{v}</span>
    </div>
  );
}

function storageSize() {
  if (typeof window === "undefined") return "—";
  let bytes = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      bytes += (window.localStorage.getItem(key) ?? "").length + key.length;
    }
  } catch {
    return "—";
  }
  return bytes > 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

function viewportLabel() {
  if (typeof window === "undefined") return "—";
  return `${window.innerWidth}×${window.innerHeight}`;
}

function formatBuildTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
