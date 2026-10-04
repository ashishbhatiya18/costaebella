"use client";

import { useEffect, useState } from "react";
import { api, PayoutSummaryResponse } from "@/lib/shiftly/api";
import { buildPayoutReportPdf } from "@/lib/shiftly/payout-report";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { PeriodNavigator } from "@/components/admin/ui/period-navigator";
import { usePageTitle } from "@/lib/admin/use-page-title";
import { useAuth } from "@/lib/admin/auth-context";
import { periodLabel, todayStr } from "@/lib/admin/period";

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export default function PayoutSummaryPage() {
  usePageTitle("Payout Summary");
  const { role } = useAuth();
  const allowed = role === "owner" || role === "accounting";
  // Any date in the month being viewed; the backend takes it as YYYY-MM.
  const [anchor, setAnchor] = useState(todayStr());
  const month = anchor.slice(0, 7);
  const [data, setData] = useState<PayoutSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoading(true);
    api
      .payoutSummary(month)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, month]);

  // Nav already hides this tab for non-accounting roles — this covers
  // direct navigation. Real enforcement is server-side
  // (GET /api/shiftly/summary/payout).
  if (!allowed) {
    return (
      <div>
        <h1 className="font-display text-2xl text-navy">Payout Summary</h1>
        <Card className="mt-6 p-10 text-center">
          <p className="font-medium text-navy">You don&apos;t have access to the payout summary.</p>
          <p className="mt-1 text-sm text-navy/60">This view is restricted to the accounting role.</p>
        </Card>
      </div>
    );
  }

  const total = data?.employees.reduce((sum, e) => sum + e.net_payout_cents, 0) ?? 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-navy">Payout Summary</h1>
        <p className="mt-1 text-sm text-navy/60">
          Hourly rate = monthly pay ÷ (days in month × eligible hours/day). Paid for hours worked, plus eligible hours for each weekly off.
        </p>
      </div>

      <div className="mb-6">
        <PeriodNavigator type="month" anchor={anchor} onChange={setAnchor} />
      </div>

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : (
        <>
          <Card className="mb-4 flex items-center justify-between p-5">
            <span className="text-sm text-navy/60">Total net payout for {periodLabel("month", anchor)}</span>
            <span className="text-2xl font-semibold text-navy">{formatMoney(total)}</span>
          </Card>

          <Card className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-cream/60 text-xs uppercase tracking-wide text-navy/50">
                <tr>
                  <th className="px-5 py-3 font-medium">Employee</th>
                  <th className="px-5 py-3 font-medium">Hourly rate</th>
                  <th className="px-5 py-3 font-medium">Hours worked</th>
                  <th className="px-5 py-3 font-medium">Weekly off paid</th>
                  <th className="px-5 py-3 text-right font-medium">Gross pay</th>
                  <th className="px-5 py-3 text-right font-medium">Advance</th>
                  <th className="px-5 py-3 text-right font-medium">Net payout</th>
                  <th className="px-5 py-3 font-medium">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/10">
                {data?.employees.map((e) => (
                  <tr key={e.employee_id} className="text-navy/70">
                    <td className="px-5 py-3 font-medium text-navy">{e.employee_name}</td>
                    <td className="px-5 py-3">{formatMoney(e.hourly_rate_cents)}/hr</td>
                    <td className="px-5 py-3">{e.total_hours_worked}h</td>
                    <td className="px-5 py-3">{e.paid_off_hours}h</td>
                    <td className="px-5 py-3 text-right">{formatMoney(e.gross_pay_cents)}</td>
                    <td className="px-5 py-3 text-right text-coral">
                      {e.advance_cents > 0 ? `- ${formatMoney(e.advance_cents)}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-navy">
                      {formatMoney(e.net_payout_cents)}
                    </td>
                    <td className="px-5 py-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => buildPayoutReportPdf(e.employee_name, data.month, e)}
                      >
                        Download
                      </Button>
                    </td>
                  </tr>
                ))}
                {data?.employees.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-navy/50">
                      No employees to show yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
