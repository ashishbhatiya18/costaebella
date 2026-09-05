"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function IntellyHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/intelly/dashboard/overview");
  }, [router]);
  return null;
}
