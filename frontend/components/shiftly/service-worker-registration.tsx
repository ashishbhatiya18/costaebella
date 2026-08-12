"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Never register in dev: the SW's cache-first strategy for static assets
    // fights with Turbopack/webpack Fast Refresh (chunk hashes change on
    // every rebuild, the SW keeps serving stale ones, the client detects the
    // mismatch and reloads, the SW intercepts that reload too) — producing an
    // infinite reload loop instead of ever showing the page.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => reg.unregister()));
      return;
    }

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    navigator.serviceWorker
      .register(`${basePath}/sw.js`, { scope: `${basePath}/` })
      .catch(() => {
        // Best-effort: offline support/installability degrades gracefully.
      });
  }, []);

  return null;
}
