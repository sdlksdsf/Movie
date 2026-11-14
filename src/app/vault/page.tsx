import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { VAULT_COOKIE, verifyVaultToken, vaultConfigured } from "@/lib/vault";
import { VaultScreen } from "@/components/vault-screen";

/**
 * The 18+ vault.
 *
 * Three separate things have to be true before a byte of this page is served:
 * the deployment has a PIN configured, the request carries a valid signed
 * cookie, and (in the client below) the active profile is an adult one. Miss
 * any of them and this returns a 404 — not a "locked" screen, a real 404, so
 * the route cannot be discovered by poking around.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "NOFLIX",
  description: "Restricted.",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
  other: { referrer: "no-referrer" },
};

export default async function VaultPage() {
  if (!vaultConfigured()) notFound();
  const jar = await cookies();
  if (!verifyVaultToken(jar.get(VAULT_COOKIE)?.value)) notFound();
  return <VaultScreen />;
}
