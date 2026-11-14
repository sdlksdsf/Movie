import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-side gate for the 18+ vault.
 *
 * The whole point of this module is that the decision is *not* made in the
 * browser. A profile's maturity level lives in localStorage, which any teenager
 * can edit, so nothing here trusts the client: the page and the API both check
 * an httpOnly, HMAC-signed cookie that only a correct PIN can create.
 */

export const VAULT_COOKIE = "nf_vault";
export const VAULT_TTL_SECONDS = 45 * 60;

/** Great, but optional: lets the cookie outlive a PIN change if you rotate one. */
const secret = () => process.env.VAULT_SECRET || process.env.VAULT_PIN || "";

/** No PIN on the deployment → the feature does not exist at all. */
export function vaultConfigured(): boolean {
  return Boolean(process.env.VAULT_PIN && secret());
}

function digest(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** `v1.<expiry ms>.<hmac>` — no user data, nothing to leak. */
export function mintVaultToken(now = Date.now()): string {
  const expires = now + VAULT_TTL_SECONDS * 1000;
  const payload = `v1.${expires}`;
  return `${payload}.${digest(payload)}`;
}

export function verifyVaultToken(token?: string | null): boolean {
  if (!token || !secret()) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expires, mac] = parts;
  if (version !== "v1") return false;
  if (!sameText(mac, digest(`${version}.${expires}`))) return false;
  const at = Number(expires);
  return Number.isFinite(at) && at > Date.now();
}

export function pinMatches(pin: string): boolean {
  const expected = process.env.VAULT_PIN ?? "";
  if (!expected) return false;
  return sameText(pin.normalize(), expected.normalize());
}

/** Flags shared by the set and clear paths, so they can never drift apart. */
export const vaultCookieOptions = (maxAge = VAULT_TTL_SECONDS) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

/* ---------------------------------------------------------------- throttling */

type Attempt = { count: number; resetAt: number };

const attempts = new Map<string, Attempt>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Five wrong PINs per ten minutes, per instance. Not a substitute for a real
 * identity provider, but it turns "guess four digits" into "not today".
 */
export function throttle(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

export function clearThrottle(key: string): void {
  attempts.delete(key);
}
