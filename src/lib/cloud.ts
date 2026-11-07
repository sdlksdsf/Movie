"use client";

/**
 * Optional Supabase sync.
 *
 * Everything works offline-first in localStorage; when a Supabase project is
 * configured (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY) each
 * device mirrors its profile, My List and watch progress to a single row in
 * `app_state`, keyed by an anonymous device id and protected by row-level
 * security that only exposes the caller's own row.
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudEnabled = Boolean(URL_BASE && ANON);

const DEVICE_KEY = "nf.device";
const STAMP_KEY = "nf.savedAt";

const SYNCED = ["nf.profile", "nf.profiles", "nf.mylist", "nf.progress", "nf.player", "nf.quality"];

export function deviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return "anonymous";
  }
}

export function snapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of SYNCED) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) out[key] = JSON.parse(raw);
    } catch {
      /* ignore a half-written value */
    }
  }
  return out;
}

function headers(): Record<string, string> {
  return {
    apikey: ANON as string,
    Authorization: `Bearer ${ANON}`,
    "Content-Type": "application/json",
    "x-device-id": deviceId(),
  };
}

export type RemoteState = { data: Record<string, unknown>; updatedAt: string };

export async function pull(): Promise<RemoteState | null> {
  if (!cloudEnabled) return null;
  try {
    const res = await fetch(
      `${URL_BASE}/rest/v1/app_state?device_id=eq.${encodeURIComponent(deviceId())}&select=data,updated_at`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ data: Record<string, unknown>; updated_at: string }>;
    const row = rows[0];
    return row ? { data: row.data ?? {}, updatedAt: row.updated_at } : null;
  } catch {
    return null;
  }
}

export async function push(data: Record<string, unknown>): Promise<boolean> {
  if (!cloudEnabled) return false;
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/app_state?on_conflict=device_id`, {
      method: "POST",
      headers: { ...headers(), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([
        { device_id: deviceId(), data, updated_at: new Date().toISOString() },
      ]),
    });
    if (res.ok) {
      try {
        window.localStorage.setItem(STAMP_KEY, String(Date.now()));
      } catch {
        /* quota */
      }
    }
    return res.ok;
  } catch {
    return false;
  }
}

export function localStamp(): number {
  try {
    return Number(window.localStorage.getItem(STAMP_KEY) ?? 0);
  } catch {
    return 0;
  }
}
