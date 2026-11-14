import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  VAULT_COOKIE,
  VAULT_TTL_SECONDS,
  clearThrottle,
  mintVaultToken,
  pinMatches,
  throttle,
  vaultConfigured,
  vaultCookieOptions,
  verifyVaultToken,
} from "@/lib/vault";
import { loadVaultFeed } from "@/lib/vault-source";

/* every response here is private: no CDN, no shared cache, no search engine */
const PRIVATE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Cookie",
} as const;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const locked = () => NextResponse.json({ error: "locked" }, { status: 401, headers: PRIVATE });
const disabled = () => NextResponse.json({ error: "disabled" }, { status: 404, headers: PRIVATE });

/** Is the current browser holding a live vault session? */
export async function GET() {
  if (!vaultConfigured()) return disabled();
  const jar = await cookies();
  if (!verifyVaultToken(jar.get(VAULT_COOKIE)?.value)) return locked();
  const feed = await loadVaultFeed();
  return NextResponse.json(feed, { headers: PRIVATE });
}

/** Exchange a PIN for a 45-minute session cookie. */
export async function POST(request: Request) {
  if (!vaultConfigured()) return disabled();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  const gate = throttle(ip);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "throttled", retryAfter: gate.retryAfter },
      { status: 429, headers: { ...PRIVATE, "Retry-After": String(gate.retryAfter) } },
    );
  }

  let pin = "";
  try {
    const body = (await request.json()) as { pin?: unknown };
    pin = typeof body?.pin === "string" ? body.pin : "";
  } catch {
    /* fall through to the denial below */
  }

  if (!pinMatches(pin)) {
    return NextResponse.json({ error: "denied" }, { status: 401, headers: PRIVATE });
  }

  clearThrottle(ip);
  const response = NextResponse.json({ ok: true, expiresIn: VAULT_TTL_SECONDS }, { headers: PRIVATE });
  response.cookies.set({ ...vaultCookieOptions(), name: VAULT_COOKIE, value: mintVaultToken() });
  return response;
}

/** Lock immediately — used by the “Lock vault” button and by non-adult profiles. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { headers: PRIVATE });
  response.cookies.set({ ...vaultCookieOptions(0), name: VAULT_COOKIE, value: "" });
  return response;
}
