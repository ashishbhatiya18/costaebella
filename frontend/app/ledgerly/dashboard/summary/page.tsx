"use client";

import { useEffect, useState } from "react";
import { api, PnlSummary } from "@/lib/ledgerly/api";
import { useLedgerlyAccess } from "@/lib/ledgerly/use-access";
import { Card } from "@/components/admin/ui/card";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { formatINR } from "@/lib/admin/format";
import { usePageTitle } from "@/lib/admin/use-page-title";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function PnlSummaryPage() {
  usePageTitle("P&L Summary");
  const access = useLedgerlyAccess();
  const [range, setRange] = useState<"week" | "month">("week");
  const [summary, setSummary] = useState<PnlSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (access !== "allowed") return;
    setLoading(true);
    api
      .pnlSummary(range, today())
      .then((data) => setSummary({ ...data, pantrly_purchases: data.pantrly_purchases ?? [] }))
      .finally(() => setLoading(false));
  }, [access, range]);

  if (access === "checking") return null;

  if (access === "denied") {
    return (
      <div>
        <h1 className="font-display text-2xl text-navy">P&L Summary</h1>
        <Card className="mt-6 p-10 text-center">
          <p className="font-medium text-navy">You don&apos;t have access to the P&amp;L summary.</p>
          <p className="mt-1 text-sm text-navy/60">
            This view is restricted to a small set of emails. Log Revenue and Payments are still available to you.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">P&amp;L Summary</h1>
          <p className="mt-1 text-sm text-navy/60">Revenue, expenses, and profit for the period.</p>
        </div>
        <SegmentedControl
          options={[
            { label: "This week", value: "week" },
            { label: "This month", value: "month" },
          ]}
          value={range}
          onChange={setRange}
        />
      </div>

      {loading || !summary ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wide text-navy/50">Revenue</p>
              <p className="mt-2 font-display text-2xl text-navy">{formatINR(summary.revenue_cents)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wide text-navy/50">Expenses</p>
              <p className="mt-2 font-display text-2xl text-navy">{formatINR(summary.expenses_cents)}</p>
              <p className="mt-1 text-xs text-navy/50">
                {formatINR(summary.payments_cents)} payments + {formatINR(summary.purchases_cents)} Pantrly deliveries
                {" + "}
                {formatINR(summary.advances_cents)} advances
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wide text-navy/50">Profit</p>
              <p
                className={
                  "mt-2 font-display text-2xl " + (summary.profit_cents >= 0 ? "text-teal" : "text-coral")
                }
              >
                {formatINR(summary.profit_cents)}
              </p>
            </Card>
          </div>

          {summary.pantrly_purchases.length > 0 && (
            <Card className="mt-4 overflow-x-auto">
              <div className="border-b border-navy/10 px-5 py-3 text-sm font-medium text-navy">
                Pantrly deliveries in range
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Item</th>
                    <th className="px-5 py-3">Quantity</th>
                    <th className="px-5 py-3">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.pantrly_purchases.map((p) => (
                    <tr key={p.id} className="border-b border-navy/5 last:border-0">
                      <td className="px-5 py-3 text-navy/70">{p.purchase_date}</td>
                      <td className="px-5 py-3 text-navy">{p.item_name}</td>
                      <td className="px-5 py-3 text-navy/70">{p.quantity}</td>
                      <td className="px-5 py-3 font-medium text-navy">
                        {p.cost_cents != null ? formatINR(p.cost_cents) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
