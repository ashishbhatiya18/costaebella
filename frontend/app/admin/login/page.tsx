"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useAuth } from "@/lib/admin/auth-context";
import { ApiError } from "@/lib/admin/api";
import { usePageTitle } from "@/lib/admin/use-page-title";

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

export default function AdminLoginPage() {
  usePageTitle("Login");
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  async function handleCredential(response: { credential: string }) {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle(response.credential);
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
      theme: "outline",
      size: "large",
      shape: "pill",
      width: 300,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-5 py-16 text-center">
      <p className="uppercase tracking-[0.3em] text-teal text-xs mb-3">
        Admin
      </p>
      <h1 className="font-display text-4xl text-navy">Sign in</h1>
      <p className="mt-3 text-sm text-navy/70">
        Sign in with your Google account to manage Costa È Bella&apos;s admin
        apps.
      </p>

      <div className="mt-10 flex w-full flex-col items-center gap-4 rounded-2xl border border-navy/10 bg-teal/5 p-8">
        <div ref={buttonRef} />
        {loading && <p className="text-sm text-navy/60">Signing in…</p>}
        {error && (
          <p className="w-full rounded-lg bg-coral/10 px-3 py-2 text-center text-sm text-coral">
            {error}
          </p>
        )}
      </div>

      <p className="mt-8 text-xs text-navy/50">
        Admin access only. Contact the site owner if you need access.
      </p>

      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
    </div>
  );
}
