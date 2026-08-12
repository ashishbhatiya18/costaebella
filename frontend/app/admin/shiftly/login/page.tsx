"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useAuth } from "@/lib/admin/auth-context";
import { ApiError } from "@/lib/shiftly/api";

const BUILD_YEAR = new Date().getFullYear();
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(BUILD_YEAR);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  async function handleCredential(response: { credential: string }) {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle(
        response.credential,
        "/admin/shiftly/dashboard/log-attendance",
      );
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403
          ? "This Google account is not authorized to sign in."
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!scriptLoaded || !buttonRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredential,
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "filled_black",
      size: "large",
      shape: "pill",
      width: 320,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-cream px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal font-bold text-white">
            S
          </div>
          <span className="font-display text-lg tracking-tight text-navy">
            Shiftly
          </span>
        </div>

        <h2 className="font-display text-3xl text-navy">Welcome back</h2>
        <p className="mt-1.5 text-sm text-navy/70">
          Sign in to your admin dashboard to manage staff and attendance.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-navy/10 bg-white p-8 shadow-sm shadow-navy/5">
          <div ref={buttonRef} />
          {loading && <p className="text-sm text-navy/60">Signing in…</p>}
          {error && (
            <p className="w-full rounded-lg bg-coral/10 px-3 py-2 text-center text-sm text-coral">
              {error}
            </p>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-navy/50">
          Admin access only. Contact your account owner if you need a login.
        </p>
        <p className="mt-2 text-center text-xs text-navy/40">
          &copy; {year} Shiftly. Built for restaurant teams.
        </p>
      </div>

      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      <Link href="/admin/shiftly" className="sr-only">
        Home
      </Link>
    </div>
  );
}
