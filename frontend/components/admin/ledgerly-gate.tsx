"use client";

// Reused by any app restricted to the same owner-only gate as Ledgerly's
// own P&L/Tax Export tabs (currently Menuly and Intel-ly) — probes the
// same GET /api/ledgerly/access endpoint. Real enforcement is server-side
// either way; this just avoids dangling a UI that would 403 on every call.
import { useLedgerlyAccess } from "@/lib/ledgerly/use-access";
import { Card } from "@/components/admin/ui/card";

export function LedgerlyGate({ children, appName }: { children: React.ReactNode; appName: string }) {
  const access = useLedgerlyAccess();

  if (access === "checking") return null;

  if (access === "denied") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-5">
        <Card className="w-full p-10 text-center">
          <p className="font-medium text-navy">You don&apos;t have access to {appName}.</p>
          <p className="mt-1 text-sm text-navy/60">This app is restricted to the owner role.</p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
