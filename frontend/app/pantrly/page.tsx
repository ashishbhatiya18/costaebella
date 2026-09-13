"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PantrlyHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/pantrly/dashboard/items");
  }, [router]);
  return null;
}
