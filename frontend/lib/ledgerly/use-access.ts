"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/ledgerly/api";

export type LedgerlyAccessState = "checking" | "denied" | "allowed";

// Probes GET /api/ledgerly/access once per mount — owner-only on the
// backend (accessly.RequireOwner). Used to hide the P&L Summary/Tax Export
// nav tabs (and Menuly/Intel-ly's own gate, see LedgerlyGate) from admins
// who can't use them, and to gate those pages themselves — real
// enforcement is server-side either way, this just avoids dangling a link
// that would 403.
export function useLedgerlyAccess(opts?: { skip?: boolean }): LedgerlyAccessState {
  const skip = opts?.skip ?? false;
  const [state, setState] = useState<LedgerlyAccessState>(
    skip ? "denied" : "checking",
  );

  useEffect(() => {
    if (skip) {
      setState("denied");
      return;
    }
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
  }, [skip]);

  return state;
}
