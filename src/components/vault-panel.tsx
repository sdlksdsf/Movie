"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/components/store";

/**
 * Entry point for the 18+ vault.
 *
 * Rendered *only* by the settings screen, and only for a profile whose maturity
 * is already "all" and that is not a kids profile — that check lives at the
 * call site, so this component is never even mounted for anyone else. It is not
 * linked from the navbar, the footer, search or any shelf.
 */
export function VaultPanel() {
  const router = useRouter();
  const { profile } = useStore();
  const [status, setStatus] = useState<"unknown" | "locked" | "open" | "disabled">("unknown");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adult = Boolean(profile && !profile.kids && profile.maturity === "all");

  useEffect(() => {
    if (!adult) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/vault", { cache: "no-store" });
        if (!alive) return;
        if (res.status === 200) setStatus("open");
        else if (res.status === 404) setStatus("disabled");
        else setStatus("locked");
      } catch {
        if (alive) setStatus("locked");
      }
    })();
    return () => {
      alive = false;
    };
  }, [adult]);

  if (!adult) return null;

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.status === 200) {
        setPin("");
        router.push("/vault");
        return;
      }
      if (res.status === 429) setError("Too many attempts. Try again in a few minutes.");
      else if (res.status === 404) setStatus("disabled");
      else setError("That PIN is not right.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-[#ff5c5c]/30 bg-[#ff5c5c]/[0.04] p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-semibold text-white">18+ vault</h2>
        <span className="rounded border border-[#ff5c5c]/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ff8080]">
          Adults only
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-white/40">
        A separate, PIN-protected section for adult titles. It never appears in the catalogue, search, shelves or rows,
        and this panel is only visible on a profile set to <span className="text-white/60">All</span> maturity.
      </p>

      {status === "disabled" && (
        <p className="mt-4 rounded-md border border-white/12 bg-white/[0.03] px-3 py-2 text-[12.5px] leading-relaxed text-white/50">
          Not set up on this deployment. Set <code className="text-white/75">VAULT_PIN</code> to arm the vault. Content
          comes from <code className="text-white/75">VAULT_PROVIDER</code> (Eporner by default) or your own{" "}
          <code className="text-white/75">VAULT_FEED_URL</code>; nothing is hosted here.
        </p>
      )}

      {status === "open" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/vault")}
            className="rounded-md bg-[#ff5c5c] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#ff7070]"
          >
            Open the vault
          </button>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/vault", { method: "DELETE" }).catch(() => undefined);
              setStatus("locked");
            }}
            className="rounded-md border border-white/20 px-3 py-2 text-[12.5px] text-white/75 transition hover:border-white hover:text-white"
          >
            Lock now
          </button>
          <span className="text-[11.5px] text-white/35">Session ends by itself after 45 minutes.</span>
        </div>
      )}

      {(status === "locked" || status === "unknown") && (
        <form onSubmit={unlock} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Vault PIN
            </span>
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              className="w-40 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={busy || pin.length === 0}
            className="rounded-md bg-[#ff5c5c] px-4 py-2 text-[13px] font-semibold text-white transition enabled:hover:bg-[#ff7070] disabled:opacity-40"
          >
            {busy ? "Checking…" : "Unlock"}
          </button>
          <span className="text-[11.5px] text-white/30">Set by the site owner — not your profile name.</span>
        </form>
      )}

      {error && <p className="mt-2 text-[12px] text-[#ff8080]">{error}</p>}
    </section>
  );
}
