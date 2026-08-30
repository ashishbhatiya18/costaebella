"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // This is a public marketing site first; the PWA install shortcuts
    // exist for admins to reach Shiftly/Pantrly/Ledgerly, not for every
    // visitor. Suppress Chrome's automatic install prompt/mini-infobar —
    // admins who want it can still install manually via the browser menu.
    function suppressInstallPrompt(e: Event) {
      e.preventDefault();
    }
    window.addEventListener("beforeinstallprompt", suppressInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", suppressInstallPrompt);
  }, []);

  return null;
}
