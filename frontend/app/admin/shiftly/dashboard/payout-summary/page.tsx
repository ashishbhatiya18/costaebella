"use client";

import { useEffect, useMemo, useState } from "react";
import { api, PayoutSummaryResponse } from "@/lib/shiftly/api";
import { Card } from "@/components/shiftly/ui/card";
import { SegmentedControl } from "@/components/shiftly/ui/segmented-control";
import { usePageTitle } from "@/lib/admin/use-page-title";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

// Last 6 months (oldest first, current month last).
function recentMonths(count: number) {
  const now = new Date();
  const months: { value: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
    });
  }
  return months;
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export default function PayoutSummaryPage() {
  usePageTitle("Payout Summary");
  const months = useMemo(() => recentMonths(6), []);
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<PayoutSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.payoutSummary(month).then(setData).finally(() => setLoading(false));
  }, [month]);

  const total = data?.employees.reduce((sum, e) => sum + e.payout_cents, 0) ?? 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-navy">Payout Summary</h1>
        <p className="mt-1 text-sm text-navy/60">
          Computed from committed schedule, permitted leaves, and logged attendance.
        </p>
      </div>

      <div className="mb-6">
        <SegmentedControl
          options={months.map((m) => ({ label: m.label, value: m.value }))}
          value={month}
          onChange={setMonth}
        />
      </div>

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : (
        <>
          <Card className="mb-4 flex items-center justify-between p-5">
            <span className="text-sm text-navy/60">Total payout for {data?.month}</span>
            <span className="text-2xl font-semibold text-navy">{formatMoney(total)}</span>
          </Card>

          <Card className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-cream/60 text-xs uppercase tracking-wide text-navy/50">
                <tr>
                  <th className="px-5 py-3 font-medium">Employee</th>
                  <th className="px-5 py-3 font-medium">Full days</th>
                  <th className="px-5 py-3 font-medium">Half days</th>
                  <th className="px-5 py-3 font-medium">Absent</th>
                  <th className="px-5 py-3 font-medium">Weekly off</th>
                  <th className="px-5 py-3 font-medium">Leaves used</th>
                  <th className="px-5 py-3 font-medium">Unpaid</th>
                  <th className="px-5 py-3 font-medium">Bonus hrs</th>
                  <th className="px-5 py-3 text-right font-medium">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/10">
                {data?.employees.map((e) => (
                  <tr key={e.employee_id} className="text-navy/70">
                    <td className="px-5 py-3 font-medium text-navy">{e.employee_name}</td>
                    <td className="px-5 py-3">
                      {e.full_day_count} / {e.total_days}
                    </td>
                    <td className="px-5 py-3">{e.half_day_count}</td>
                    <td className="px-5 py-3">
                      {e.absent_count > 0 ? (
                        <span className="text-coral">{e.absent_count}</span>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="px-5 py-3">{e.weekly_off_count}</td>
                    <td className="px-5 py-3">
                      {e.leaves_taken}/{e.permitted_leaves}
                    </td>
                    <td className="px-5 py-3">
                      {e.unpaid_leave_days > 0 ? (
                        <span className="text-coral">{e.unpaid_leave_days}</span>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {e.bonus_hours > 0 ? (
                        <span className="text-teal">{e.bonus_hours.toFixed(1)}</span>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-navy">
                      {formatMoney(e.payout_cents)}
                      {e.bonus_pay_cents > 0 && (
                        <div className="mt-0.5 text-right text-xs font-normal text-teal">
                          incl. {formatMoney(e.bonus_pay_cents)} bonus
                        </div>
                      )}
                      {e.prorated_fraction < 1 && (
                        <div className="mt-0.5 text-right text-xs font-normal text-amber-600">
                          Prorated ({Math.round(e.prorated_fraction * 100)}% of{" "}
                          {formatMoney(e.full_monthly_pay_cents)})
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {data?.employees.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-navy/50">
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
