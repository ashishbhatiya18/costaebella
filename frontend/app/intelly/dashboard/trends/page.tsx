"use client";

import { useEffect, useState } from "react";
import { api as ledgerlyApi } from "@/lib/ledgerly/api";
import { api as pantrlyApi } from "@/lib/pantrly/api";
import { Card } from "@/components/admin/ui/card";
import { formatINR } from "@/lib/admin/format";
import { PeriodNavigator } from "@/components/admin/ui/period-navigator";
import { usePageTitle } from "@/lib/admin/use-page-title";
// Monday-start weeks — same convention as every other range endpoint.
import { isCurrentPeriod, periodBounds, periodLabel, shiftAnchor, todayStr } from "@/lib/admin/period";

const WEEKS_OF_HISTORY = 6;

type WeekRow = {
  from: string;
  to: string;
  revenueCents: number;
  purchasesCents: number;
  expensesCents: number;
  profitCents: number;
  untaggedSalesPct: number;
};

export default function IntellyTrendsPage() {
  usePageTitle("Trends");
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Any date in the newest week shown; the table covers the
  // WEEKS_OF_HISTORY weeks ending with it.
  const [anchor, setAnchor] = useState(todayStr());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const ranges: [string, string][] = [];
    for (let i = WEEKS_OF_HISTORY - 1; i >= 0; i--) {
      const { from, to } = periodBounds("week", shiftAnchor("week", anchor, -i));
      ranges.push([from, to]);
    }

    Promise.all(
      ranges.map(async ([from, to]) => {
        const [sales, payments, purchases] = await Promise.all([
          ledgerlyApi.listSales({ from, to }),
          ledgerlyApi.listPayments({ from, to }),
          pantrlyApi.listPurchases({ from, to }),
        ]);
        const revenueCents = (sales ?? []).reduce((sum, s) => sum + s.amount_cents, 0);
        const paymentsCents = (payments ?? []).reduce((sum, p) => sum + p.amount_cents, 0);
        const purchasesCents = (purchases ?? []).reduce((sum, p) => sum + (p.cost_cents ?? 0), 0);
        const expensesCents = paymentsCents + purchasesCents;
        const untagged = (sales ?? []).filter((s) => (s.item_names ?? []).length === 0).length;
        const untaggedSalesPct = (sales ?? []).length > 0 ? (untagged / (sales ?? []).length) * 100 : 0;
        return {
          from,
          to,
          revenueCents,
          purchasesCents,
          expensesCents,
          profitCents: revenueCents - expensesCents,
          untaggedSalesPct,
        };
      }),
    )
      .then((rows) => {
        if (!cancelled) setWeeks(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [anchor]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Trends</h1>
          <p className="mt-1 text-sm text-navy/60">
            {isCurrentPeriod("week", anchor) ? "Last" : "The"} {WEEKS_OF_HISTORY} weeks ending{" "}
            {periodLabel("week", anchor)}, week over week — is revenue and inventory spend moving together,
            and is Menuly&apos;s data quality holding up.
          </p>
        </div>
        <PeriodNavigator type="week" anchor={anchor} onChange={setAnchor} />
      </div>

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                <th className="px-5 py-3">Week</th>
                <th className="px-5 py-3">Revenue</th>
                <th className="px-5 py-3">Pantrly purchases</th>
                <th className="px-5 py-3">Profit (excl. labor)</th>
                <th className="px-5 py-3">WoW revenue</th>
                <th className="px-5 py-3">Untagged sales</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => {
                const prev = weeks[i - 1];
                const wowPct = prev && prev.revenueCents > 0 ? ((w.revenueCents - prev.revenueCents) / prev.revenueCents) * 100 : null;
                return (
                  <tr key={w.from} className="border-b border-navy/5 last:border-0">
                    <td className="px-5 py-3 font-medium text-navy">
                      {w.from} – {w.to}
                    </td>
                    <td className="px-5 py-3 text-navy/70">{formatINR(w.revenueCents)}</td>
                    <td className="px-5 py-3 text-navy/70">{formatINR(w.purchasesCents)}</td>
                    <td className={"px-5 py-3 font-medium " + (w.profitCents >= 0 ? "text-navy" : "text-coral")}>
                      {formatINR(w.profitCents)}
                    </td>
                    <td className="px-5 py-3">
                      {wowPct == null ? (
                        <span className="text-navy/40">—</span>
                      ) : (
                        <span className={wowPct >= 0 ? "text-teal" : "text-coral"}>
                          {wowPct >= 0 ? "+" : ""}
                          {wowPct.toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={w.untaggedSalesPct > 20 ? "font-medium text-coral" : "text-navy/50"}>
                        {w.untaggedSalesPct.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
