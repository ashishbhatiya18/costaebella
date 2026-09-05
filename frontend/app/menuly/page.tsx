"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MenulyHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/menuly/dashboard/items");
  }, [router]);
  return null;
}
