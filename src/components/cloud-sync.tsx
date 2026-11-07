"use client";

import { useEffect } from "react";
import { cloudEnabled, localStamp, pull, push, snapshot } from "@/lib/cloud";

/**
 * Mirrors the local watching state to Supabase in the background.
 * Renders nothing; silently does nothing when no database is configured.
 */
export function CloudSync() {
  useEffect(() => {
    if (!cloudEnabled) return;

    let cancelled = false;
    let interval: number | undefined;

    const flush = () => {
      if (cancelled) return;
      void push(snapshot());
    };

    (async () => {
      const remote = await pull();
      if (cancelled) return;

      const alreadyAdopted =
        typeof sessionStorage !== "undefined" && sessionStorage.getItem("nf.cloud.applied") === "1";
      const remoteTime = remote ? Date.parse(remote.updatedAt) : 0;

      /* a newer copy exists on the server: adopt it once, then reload so the
         store rehydrates from the freshly written keys */
      if (remote && !alreadyAdopted && remoteTime > localStamp() + 1500) {
        try {
          for (const [key, value] of Object.entries(remote.data)) {
            if (key.startsWith("nf.")) window.localStorage.setItem(key, JSON.stringify(value));
          }
          sessionStorage.setItem("nf.cloud.applied", "1");
          window.location.reload();
          return;
        } catch {
          /* fall through to the normal push loop */
        }
      }

      if (!remote) flush();
      else if (JSON.stringify(remote.data) !== JSON.stringify(snapshot())) {
        const remoteKeys = Object.keys(remote.data).length;
        if (remoteKeys === 0) flush();
      }

      interval = window.setInterval(flush, 15000);
    })();

    const onHide = () => flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  return null;
}
