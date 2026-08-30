"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/ledgerly/api";

export type LedgerlyAccessState = "checking" | "denied" | "allowed";

// Probes GET /api/ledgerly/summary/pnl's access gate once per mount. Used
// both to hide the P&L Summary nav tab from admins who can't use it, and
// to gate the summary page itself (real enforcement is server-side either
// way — this is purely so the UI doesn't dangle a link that 403s).
export function useLedgerlyAccess(): LedgerlyAccessState {
  const [state, setState] = useState<LedgerlyAccessState>("checking");

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
