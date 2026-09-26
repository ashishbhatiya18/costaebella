"use client";

import { useEffect, useState } from "react";
import { api, PnlSummary, PnlTrendPoint } from "@/lib/ledgerly/api";
import { useLedgerlyAccess } from "@/lib/ledgerly/use-access";
import { Card } from "@/components/admin/ui/card";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { PnlTrendChart } from "@/components/ledgerly/pnl-trend-chart";
import { PnlSankey } from "@/components/ledgerly/pnl-sankey";
import { formatINR } from "@/lib/admin/format";
import { usePageTitle } from "@/lib/admin/use-page-title";

const TREND_PERIODS = 8;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function PnlSummaryPage() {
  usePageTitle("P&L Summary");
  const access = useLedgerlyAccess();
  const [range, setRange] = useState<"week" | "month">("week");
  const [summary, setSummary] = useState<PnlSummary | null>(null);
  const [trend, setTrend] = useState<PnlTrendPoint[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (access !== "allowed") return;
    setLoading(true);
    Promise.all([
      api.pnlSummary(range, today()),
      api.pnlTrend(range, TREND_PERIODS),
    ])
      .then(([summaryData, trendData]) => {
        setSummary({ ...summaryData, pantrly_purchases: summaryData.pantrly_purchases ?? [] });
        setTrend(trendData.periods ?? []);
      })
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
            This view is restricted to the owner role. Log Income and Expense are still available to you.
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
          <p className="mt-1 text-sm text-navy/60">Income, expenses, and profit for the period.</p>
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
              <p className="text-xs uppercase tracking-wide text-navy/50">Income</p>
              <p className="mt-2 font-display text-2xl text-navy">{formatINR(summary.revenue_cents)}</p>
              <p className="mt-1 text-xs text-navy/50">
                {formatINR(summary.revenue_cash_cents)} cash + {formatINR(summary.revenue_card_cents)} card
                {" + "}
                {formatINR(summary.revenue_upi_cents)} UPI
                {summary.revenue_other_cents > 0 && <> + {formatINR(summary.revenue_other_cents)} other</>}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wide text-navy/50">Expenses</p>
              <p className="mt-2 font-display text-2xl text-navy">{formatINR(summary.expenses_cents)}</p>
              <p className="mt-1 text-xs text-navy/50">
                {formatINR(summary.payments_cents)} expenses + {formatINR(summary.purchases_cents)} Pantrly deliveries
                {" + "}
                {formatINR(summary.advances_cents)} advances + {formatINR(summary.salary_cents)} salary accrued
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

          <PnlSankey summary={summary} />

          {trend && trend.length > 0 && <PnlTrendChart points={trend} rangeType={range} />}
        </>
      )}
    </div>
  );
}
