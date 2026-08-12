"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/shiftly/api";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getToken() ? "/admin/shiftly/dashboard/log-attendance" : "/admin/shiftly/login");
  }, [router]);

  return null;
}
