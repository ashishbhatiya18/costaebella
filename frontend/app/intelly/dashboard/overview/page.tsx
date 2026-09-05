"use client";

import { useEffect, useMemo, useState } from "react";
import { api as ledgerlyApi } from "@/lib/ledgerly/api";
import { api as pantrlyApi } from "@/lib/pantrly/api";
import { api as menulyApi } from "@/lib/menuly/api";
import { api as shiftlyApi } from "@/lib/shiftly/api";
import { Card } from "@/components/admin/ui/card";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { formatINR } from "@/lib/admin/format";
import { usePageTitle } from "@/lib/admin/use-page-title";

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  return fmt(new Date(Date.now() - n * 86400000));
}

// Monday-start week/month bounds — matches the convention every backend
// range endpoint (pnl, stock summary) already uses, so numbers here line
// up with what those apps show for "this week"/"this month".
function rangeBounds(rangeType: "week" | "month", anchor = new Date()): [string, string] {
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (rangeType === "week") {
    const offset = (a.getDay() + 6) % 7;
    const start = new Date(a);
    start.setDate(a.getDate() - offset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return [fmt(start), fmt(end)];
  }
  const start = new Date(a.getFullYear(), a.getMonth(), 1);
  const end = new Date(a.getFullYear(), a.getMonth() + 1, 0);
  return [fmt(start), fmt(end)];
}

function normalizeMethod(method: string): "cash" | "card" | "upi" | "other" {
  const m = method.trim().toLowerCase();
  return m === "cash" || m === "card" || m === "upi" ? m : "other";
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LOOKBACK_DAYS = 56; // ~8 weeks, enough samples per weekday to be meaningful

type Financials = {
  revenueCents: number;
  paymentsCents: number;
  purchasesCents: number;
  laborCostCents: number;
  expensesCents: number;
  profitCents: number;
};

type IrregularityImpact = {
  irregularEmployeeDays: number;
  irregularCalendarDays: number;
  normalCalendarDays: number;
  avgRevenueNormal: number;
  avgRevenueIrregular: number;
  estimatedImpactCents: number;
};

type WeekdayRow = {
  weekday: string;
  avgRevenue: number;
  cashPct: number;
  cardPct: number;
  upiPct: number;
  otherPct: number;
  sampleDays: number;
};

export default function IntellyOverviewPage() {
  usePageTitle("Overview");
  const [range, setRange] = useState<"week" | "month">("week");
  const [financials, setFinancials] = useState<Financials | null>(null);
  const [weekdayRows, setWeekdayRows] = useState<WeekdayRow[]>([]);
  const [staleOrLowStockCount, setStaleOrLowStockCount] = useState(0);
  const [untaggedSalesCount, setUntaggedSalesCount] = useState(0);
  const [untrackedIngredientCount, setUntrackedIngredientCount] = useState(0);
  const [irregularityImpact, setIrregularityImpact] = useState<IrregularityImpact | null>(null);
  const [loading, setLoading] = useState(true);

  const [from, to] = useMemo(() => rangeBounds(range), [range]);

  useEffect(() => {
    setLoading(true);
    const lookbackFrom = daysAgo(WEEKDAY_LOOKBACK_DAYS);
    const lookbackTo = fmt(new Date());
    const costLookbackFrom = daysAgo(90);

    Promise.all([
      ledgerlyApi.listSales({ from, to }),
      ledgerlyApi.listPayments({ from, to }),
      pantrlyApi.listPurchases({ from, to }),
      shiftlyApi.laborCostSummary(from, to),
      ledgerlyApi.listSales({ from: lookbackFrom, to: lookbackTo }),
      shiftlyApi.laborCostSummary(lookbackFrom, lookbackTo),
      pantrlyApi.stockSummary("week", fmt(new Date())),
      pantrlyApi.listPurchases({ from: costLookbackFrom, to: fmt(new Date()) }),
      menulyApi.listComposition(),
    ]).then(([sales, payments, purchases, laborCost, lookbackSales, lookbackLaborCost, stock, recentPurchases, composition]) => {
      const revenueCents = (sales ?? []).reduce((sum, s) => sum + s.amount_cents, 0);
      const paymentsCents = (payments ?? []).reduce((sum, p) => sum + p.amount_cents, 0);
      const purchasesCents = (purchases ?? []).reduce((sum, p) => sum + (p.cost_cents ?? 0), 0);
      const laborCostCents = (laborCost.days ?? []).reduce((sum, d) => sum + d.cost_cents, 0);
      const expensesCents = paymentsCents + purchasesCents + laborCostCents;

      setFinancials({
        revenueCents,
        paymentsCents,
        purchasesCents,
        laborCostCents,
        expensesCents,
        profitCents: revenueCents - expensesCents,
      });

      const untagged = (sales ?? []).filter((s) => (s.item_names ?? []).length === 0).length;
      setUntaggedSalesCount(untagged);

      const stockItems = stock.items ?? [];
      setStaleOrLowStockCount(
        stockItems.filter((it) => {
          if (it.low_stock) return true;
          if (!it.last_log_date) return true;
          const days = Math.round((Date.now() - new Date(it.last_log_date + "T00:00:00").getTime()) / 86400000);
          return days >= 14;
        }).length,
      );

      // Pantrly items with real spend behind them but no Menuly recipe
      // linking them to a dish — their consumption can't be reconciled
      // against orders at all, a blind spot for every other insight here.
      const linkedItemIds = new Set((composition ?? []).map((c) => c.pantrly_item_id));
      const costedItemIds = new Set(
        (recentPurchases ?? []).filter((p) => p.cost_cents != null).map((p) => p.item_id),
      );
      let untrackedCount = 0;
      for (const id of costedItemIds) if (!linkedItemIds.has(id)) untrackedCount++;
      setUntrackedIngredientCount(untrackedCount);

      // Revenue on days staffing had at least one irregular employee-day
      // (half day, absent, leave, unpaid leave) vs. fully-normal days —
      // the gap × irregular-day count is a rough estimate of revenue left
      // on the table when staffing wasn't at standard operational levels.
      const revenueByDate = new Map<string, number>();
      for (const s of lookbackSales ?? []) {
        revenueByDate.set(s.sale_date, (revenueByDate.get(s.sale_date) ?? 0) + s.amount_cents);
      }
      let irregularEmployeeDays = 0;
      let irregularCalendarDays = 0;
      let normalCalendarDays = 0;
      let irregularRevenueSum = 0;
      let normalRevenueSum = 0;
      for (const d of lookbackLaborCost.days ?? []) {
        irregularEmployeeDays += d.irregular_count;
        const revenue = revenueByDate.get(d.date) ?? 0;
        if (d.irregular_count > 0) {
          irregularCalendarDays++;
          irregularRevenueSum += revenue;
        } else if (d.employee_day_count > 0) {
          normalCalendarDays++;
          normalRevenueSum += revenue;
        }
      }
      const avgRevenueNormal = normalCalendarDays > 0 ? normalRevenueSum / normalCalendarDays : 0;
      const avgRevenueIrregular = irregularCalendarDays > 0 ? irregularRevenueSum / irregularCalendarDays : 0;
      setIrregularityImpact({
        irregularEmployeeDays,
        irregularCalendarDays,
        normalCalendarDays,
        avgRevenueNormal,
        avgRevenueIrregular,
        estimatedImpactCents: (avgRevenueNormal - avgRevenueIrregular) * irregularCalendarDays,
      });

      // Revenue + payment-method mix by weekday, from Ledgerly sales.
      const byWeekday = WEEKDAY_LABELS.map(() => ({
        revenueSum: 0,
        dateSet: new Set<string>(),
        methodCents: { cash: 0, card: 0, upi: 0, other: 0 },
      }));
      for (const s of lookbackSales ?? []) {
        const wd = new Date(s.sale_date + "T00:00:00").getDay();
        const bucket = byWeekday[wd];
        bucket.revenueSum += s.amount_cents;
        bucket.dateSet.add(s.sale_date);
        bucket.methodCents[normalizeMethod(s.payment_method)] += s.amount_cents;
      }
      setWeekdayRows(
        WEEKDAY_LABELS.map((label, wd) => {
          const b = byWeekday[wd];
          const sampleDays = b.dateSet.size;
          const avgRevenue = sampleDays > 0 ? b.revenueSum / sampleDays : 0;
          const total = b.revenueSum || 1;
          return {
            weekday: label,
            avgRevenue,
            cashPct: (b.methodCents.cash / total) * 100,
            cardPct: (b.methodCents.card / total) * 100,
            upiPct: (b.methodCents.upi / total) * 100,
            otherPct: (b.methodCents.other / total) * 100,
            sampleDays,
          };
        }),
      );
    }).finally(() => setLoading(false));
  }, [from, to]);

  const bestWeekday = weekdayRows.reduce(
    (best, w) => (w.sampleDays > 0 && w.avgRevenue > (best?.avgRevenue ?? -1) ? w : best),
    null as WeekdayRow | null,
  );
  const worstWeekday = weekdayRows.reduce(
    (worst, w) => (w.sampleDays > 0 && w.avgRevenue < (worst?.avgRevenue ?? Infinity) ? w : worst),
    null as WeekdayRow | null,
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Overview</h1>
          <p className="mt-1 text-sm text-navy/60">
            Restaurant health at a glance — revenue, labor and inventory spend, and data-quality gaps across
            Shiftly, Pantrly, Ledgerly, and Menuly.
          </p>
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

      {loading || !financials ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wide text-navy/50">Revenue</p>
              <p className="mt-2 font-display text-2xl text-navy">{formatINR(financials.revenueCents)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wide text-navy/50">Labor cost</p>
              <p className="mt-2 font-display text-2xl text-navy">{formatINR(financials.laborCostCents)}</p>
              <p className="mt-1 text-xs text-navy/50">Computed from attendance, not manual entries</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wide text-navy/50">Pantrly + other expenses</p>
              <p className="mt-2 font-display text-2xl text-navy">
                {formatINR(financials.purchasesCents + financials.paymentsCents)}
              </p>
              <p className="mt-1 text-xs text-navy/50">
                {formatINR(financials.purchasesCents)} Pantrly deliveries + {formatINR(financials.paymentsCents)} other payments
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wide text-navy/50">Profit</p>
              <p className={"mt-2 font-display text-2xl " + (financials.profitCents >= 0 ? "text-teal" : "text-coral")}>
                {formatINR(financials.profitCents)}
              </p>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wide text-navy/50">Inventory hygiene</p>
              <p className="mt-2 font-display text-2xl text-navy">{staleOrLowStockCount}</p>
              <p className="mt-1 text-xs text-navy/50">Pantrly items low on stock or not counted in 14+ days</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wide text-navy/50">Untagged sales</p>
              <p className="mt-2 font-display text-2xl text-navy">{untaggedSalesCount}</p>
              <p className="mt-1 text-xs text-navy/50">Sales this range with no dish tagged — breaks Menuly analytics</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wide text-navy/50">Untracked ingredients</p>
              <p className="mt-2 font-display text-2xl text-navy">{untrackedIngredientCount}</p>
              <p className="mt-1 text-xs text-navy/50">Pantrly items with real spend but no recipe link in Menuly</p>
            </Card>
          </div>

          {irregularityImpact && (
            <div className="mt-4">
              <Card className="p-5">
                <p className="text-xs uppercase tracking-wide text-navy/50">
                  Attendance irregularity impact (last {WEEKDAY_LOOKBACK_DAYS} days)
                </p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <p
                    className={
                      "font-display text-2xl " +
                      (irregularityImpact.estimatedImpactCents > 0 ? "text-coral" : "text-navy")
                    }
                  >
                    {irregularityImpact.estimatedImpactCents > 0 ? "-" : ""}
                    {formatINR(Math.abs(irregularityImpact.estimatedImpactCents))}
                  </p>
                  <p className="text-xs text-navy/50">
                    {irregularityImpact.irregularEmployeeDays} half-day/absent/leave/unpaid-leave employee-days
                    across {irregularityImpact.irregularCalendarDays} of the last {WEEKDAY_LOOKBACK_DAYS} days
                  </p>
                </div>
                <p className="mt-2 text-xs text-navy/50">
                  Avg revenue on fully-staffed days: {formatINR(irregularityImpact.avgRevenueNormal)} vs.{" "}
                  {formatINR(irregularityImpact.avgRevenueIrregular)} on days with a staffing irregularity
                  ({irregularityImpact.normalCalendarDays} normal days sampled). Estimated impact = that gap ×
                  irregular days — a rough correlation, not proof of causation (irregular staffing may itself be
                  a response to an already-quiet day).
                </p>
              </Card>
            </div>
          )}

          <div className="mt-8 mb-4">
            <h2 className="font-display text-xl text-navy">Revenue &amp; Payment Mix by Weekday</h2>
            <p className="mt-1 text-sm text-navy/60">
              Average revenue and cash/card/UPI split per weekday over the last {WEEKDAY_LOOKBACK_DAYS} days.
              {bestWeekday && worstWeekday && bestWeekday.weekday !== worstWeekday.weekday && (
                <>
                  {" "}
                  <span className="font-medium text-teal">{bestWeekday.weekday}</span> runs highest,{" "}
                  <span className="font-medium text-coral">{worstWeekday.weekday}</span> lowest.
                </>
              )}
            </p>
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                  <th className="px-5 py-3">Weekday</th>
                  <th className="px-5 py-3">Avg revenue</th>
                  <th className="px-5 py-3">Cash</th>
                  <th className="px-5 py-3">Card</th>
                  <th className="px-5 py-3">UPI</th>
                </tr>
              </thead>
              <tbody>
                {weekdayRows.map((w) => {
                  const isBest = bestWeekday?.weekday === w.weekday;
                  const isWorst = worstWeekday?.weekday === w.weekday;
                  return (
                    <tr key={w.weekday} className="border-b border-navy/5 last:border-0">
                      <td className="px-5 py-3 font-medium text-navy">
                        {w.weekday}
                        {isBest && <span className="ml-2 rounded-full bg-teal/10 px-2 py-0.5 text-xs text-teal">Best</span>}
                        {isWorst && <span className="ml-2 rounded-full bg-coral/10 px-2 py-0.5 text-xs text-coral">Lowest</span>}
                      </td>
                      <td className="px-5 py-3 text-navy/70">{formatINR(w.avgRevenue)}</td>
                      <td className="px-5 py-3 text-navy/50">{w.sampleDays > 0 ? `${w.cashPct.toFixed(0)}%` : "—"}</td>
                      <td className="px-5 py-3 text-navy/50">{w.sampleDays > 0 ? `${w.cardPct.toFixed(0)}%` : "—"}</td>
                      <td className="px-5 py-3 text-navy/50">{w.sampleDays > 0 ? `${w.upiPct.toFixed(0)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
