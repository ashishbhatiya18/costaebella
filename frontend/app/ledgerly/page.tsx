"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LedgerlyHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/ledgerly/dashboard/log-revenue");
  }, [router]);
  return null;
}
