"use client";

// Month-on-month expense breakdown. Owner-only, gated exactly like the P&L
// Summary (useLedgerlyAccess here + the gated nav tab; the backend route
// sits in the same RequireOwner group as /api/ledgerly/summary/pnl). Every
// month's numbers come from the same backend computation as the P&L
// Summary, so "Total expenses" matches P&L for that month.

import { useEffect, useState } from "react";
import { api, Category, ExpenseTrendMonth } from "@/lib/ledgerly/api";
import { useLedgerlyAccess } from "@/lib/ledgerly/use-access";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { ExpenseTrendChart, monthLabel } from "@/components/ledgerly/expense-trend-chart";
import { formatINR } from "@/lib/admin/format";
import { clsx } from "@/lib/admin/clsx";
import { usePageTitle } from "@/lib/admin/use-page-title";
import { periodBounds, todayStr } from "@/lib/admin/period";

// Typed against Category so adding a backend category fails the type check
// here until it's labelled (keep in sync with payment.ValidCategories).
const CATEGORY_LABELS: Record<Category, string> = {
  rent: "Rent",
  utilities: "Utilities",
  supplier_purchase: "Supplier purchase",
  salary: "Salary",
  maintenance: "Maintenance",
  marketing: "Marketing",
  licenses_fees: "Licenses & fees",
  transport: "Transport",
  equipment: "Equipment",
  other: "Other",
};

// Shown in their own Grocery / Salary rows, not as generic category rows.
const DEDICATED_CATEGORIES: Category[] = ["supplier_purchase", "salary"];

type PeriodOption = "3" | "6" | "12";

// Local-time YYYY-MM-DD (toISOString would shift to the previous day in IST).
function ymd(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function currentMonthStart() {
  return periodBounds("month", todayStr()).from;
}

function shiftMonths(anchor: string, delta: number) {
  const [y, m] = anchor.split("-").map(Number);
  return ymd(new Date(y, m - 1 + delta, 1));
}

type Row = {
  key: string;
  label: string;
  values: number[];
  variant: "revenue" | "expense" | "sub" | "total";
  // Show each cell as a % of that month's revenue (food / labour cost %).
  pctLabel?: string;
};

function MomChange({ cur, prev, higherIsGood }: { cur: number; prev: number | undefined; higherIsGood: boolean }) {
  if (prev === undefined) return null;
  if (prev === 0) {
    if (cur === 0) return null;
    return <span className="text-[11px] text-navy/40">new</span>;
  }
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) < 0.5) return <span className="text-[11px] text-navy/40">0%</span>;
  const up = pct > 0;
  const good = up === higherIsGood;
  return (
    <span className={clsx("text-[11px] font-medium", good ? "text-teal" : "text-coral")}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

export default function ExpenseTrendsPage() {
  usePageTitle("Expense Trends");
  const access = useLedgerlyAccess();
  const [periods, setPeriods] = useState<PeriodOption>("6");
  const [anchor, setAnchor] = useState(currentMonthStart());
  // Result tagged with the request it answers, so "loading" is derived
  // (result key != current key) rather than set synchronously in the effect.
  const [result, setResult] = useState<{ key: string; months: ExpenseTrendMonth[] | null; error: string | null } | null>(null);
  const requestKey = `${periods}|${anchor}`;

  useEffect(() => {
    if (access !== "allowed") return;
    let cancelled = false;
    const key = `${periods}|${anchor}`;
    api
      .expenseTrend(Number(periods), anchor)
      .then((data) => {
        if (!cancelled) setResult({ key, months: data.months ?? [], error: null });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, months: null, error: "Couldn't load expense trends." });
      });
    return () => {
      cancelled = true;
    };
  }, [access, periods, anchor]);

  const loading = result?.key !== requestKey;
  const months = loading ? null : result.months;
  const error = loading ? null : result.error;

  if (access === "checking") return null;

  if (access === "denied") {
    return (
      <div>
        <h1 className="font-display text-2xl text-navy">Expense Trends</h1>
        <Card className="mt-6 p-10 text-center">
          <p className="font-medium text-navy">You don&apos;t have access to expense trends.</p>
          <p className="mt-1 text-sm text-navy/60">
            This view is restricted to the owner role. Log Income and Expense are still available to you.
          </p>
        </Card>
      </div>
    );
  }

  const n = Number(periods);
  const atCurrent = anchor >= currentMonthStart();
  const windowLabel = `${monthLabel(shiftMonths(anchor, -(n - 1)))} – ${monthLabel(anchor)}`;

  const rows: Row[] = [];
  if (months && months.length > 0) {
    const col = (f: (m: ExpenseTrendMonth) => number) => months.map(f);
    const cat = (m: ExpenseTrendMonth, c: Category) => m.payments_by_category?.[c] ?? 0;
    const anyNonZero = (vals: number[]) => vals.some((v) => v !== 0);

    rows.push({ key: "revenue", label: "Income", values: col((m) => m.revenue_cents), variant: "revenue" });

    rows.push({ key: "grocery", label: "Grocery", values: col((m) => m.grocery_cents), variant: "expense", pctLabel: "food cost" });
    const pantrly = col((m) => m.grocery_pantrly_cents);
    const supplier = col((m) => m.grocery_supplier_payments_cents);
    if (anyNonZero(pantrly) && anyNonZero(supplier)) {
      rows.push({ key: "grocery-pantrly", label: "Pantrly deliveries", values: pantrly, variant: "sub" });
      rows.push({ key: "grocery-supplier", label: "Supplier payments", values: supplier, variant: "sub" });
    }

    rows.push({ key: "salary-earned", label: "Salary (earned)", values: col((m) => m.salary_earned_cents), variant: "expense", pctLabel: "labour cost" });
    rows.push({ key: "salary-paid", label: "Salary (paid)", values: col((m) => m.salary_paid_cents), variant: "expense" });
    const advances = col((m) => m.advances_cents);
    if (anyNonZero(advances)) {
      rows.push({ key: "advances", label: "Salary advances", values: advances, variant: "expense" });
    }

    (Object.keys(CATEGORY_LABELS) as Category[])
      .filter((c) => !DEDICATED_CATEGORIES.includes(c))
      .forEach((c) => {
        const values = col((m) => cat(m, c));
        if (anyNonZero(values)) rows.push({ key: c, label: CATEGORY_LABELS[c], values, variant: "expense" });
      });

    rows.push({ key: "total", label: "Total expenses", values: col((m) => m.expenses_cents), variant: "total" });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Expense Trends</h1>
          <p className="mt-1 text-sm text-navy/60">Grocery, salary, and other expenses month on month.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" onClick={() => setAnchor(shiftMonths(anchor, -n))} aria-label="Previous months">
              ←
            </Button>
            <span className="min-w-36 text-center text-sm font-medium text-navy">{windowLabel}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const next = shiftMonths(anchor, n);
                setAnchor(next > currentMonthStart() ? currentMonthStart() : next);
              }}
              disabled={atCurrent}
              aria-label="Next months"
            >
              →
            </Button>
          </div>
          <SegmentedControl
            options={[
              { label: "3 mo", value: "3" },
              { label: "6 mo", value: "6" },
              { label: "12 mo", value: "12" },
            ]}
            value={periods}
            onChange={setPeriods}
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-coral">{error}</p>
      ) : loading || !months ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : (
        <div className="space-y-4">
          <Card className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                  <th className="sticky left-0 bg-white px-5 py-3 font-medium">Category</th>
                  {months.map((m) => (
                    <th key={m.from} className="px-4 py-3 text-right font-medium">
                      {monthLabel(m.from)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className={clsx(
                      "border-b border-navy/5 last:border-0",
                      row.variant === "revenue" && "bg-sand/15",
                      row.variant === "total" && "border-t border-navy/15 bg-cream/60 font-semibold",
                    )}
                  >
                    <td
                      className={clsx(
                        "sticky left-0 whitespace-nowrap px-5 py-3",
                        row.variant === "revenue" ? "bg-[#fdf9f1] font-medium text-navy" : row.variant === "total" ? "bg-cream text-navy" : "bg-white",
                        row.variant === "expense" && "text-navy",
                        row.variant === "sub" && "pl-9 text-xs text-navy/60",
                      )}
                    >
                      {row.label}
                    </td>
                    {row.values.map((v, i) => {
                      const revenue = months[i].revenue_cents;
                      return (
                        <td key={months[i].from} className="whitespace-nowrap px-4 py-3 text-right align-top">
                          <div className={clsx(row.variant === "sub" ? "text-xs text-navy/60" : "text-navy")}>{formatINR(v)}</div>
                          <div className="flex justify-end gap-2">
                            {row.pctLabel && revenue > 0 && (
                              <span className="text-[11px] text-navy/50" title={row.pctLabel}>
                                {((v / revenue) * 100).toFixed(0)}% {row.pctLabel === "food cost" ? "food" : "labour"}
                              </span>
                            )}
                            {row.variant !== "sub" && (
                              <MomChange cur={v} prev={i > 0 ? row.values[i - 1] : undefined} higherIsGood={row.variant === "revenue"} />
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <p className="text-xs text-navy/50">
            Total expenses matches the P&amp;L Summary for each month: it adds Grocery (Pantrly deliveries + supplier
            payments), Salary (earned) from attendance, Salary (paid), Salary advances, and every other expense
            category. If the same delivery or salary is recorded in more than one of those places, it is counted
            more than once. % change is against the previous month; food / labour cost is % of that month&apos;s income.
          </p>

          <ExpenseTrendChart months={months} />
        </div>
      )}
    </div>
  );
}
