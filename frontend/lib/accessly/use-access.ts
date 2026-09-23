"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/accessly/api";

export type AccesslyAccessState = "checking" | "denied" | "allowed";

// Probes GET /api/accessly/access's owner-only gate once per mount. Used
// both to hide the Accessly launcher tile from non-owners, and to gate the
// users page itself (real enforcement is server-side either way — this is
// purely so the UI doesn't dangle a link that 403s), mirroring
// lib/ledgerly/use-access.ts.
export function useAccesslyAccess(): AccesslyAccessState {
  const [state, setState] = useState<AccesslyAccessState>("checking");

  useEffect(() => {
    let cancelled = false;
    api
      .checkAccess()
      .then(() => {
        if (!cancelled) setState("allowed");
      })
      .catch(() => {
        if (!cancelled) setState("denied");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
