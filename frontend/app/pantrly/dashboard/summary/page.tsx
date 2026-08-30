"use client";

import { useEffect, useState } from "react";
import { api, StockSummaryResponse } from "@/lib/pantrly/api";
import { Card } from "@/components/admin/ui/card";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { usePageTitle } from "@/lib/admin/use-page-title";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function StockSummaryPage() {
  usePageTitle("Stock Summary");
  const [range, setRange] = useState<"week" | "month">("week");
  const [summary, setSummary] = useState<StockSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .stockSummary(range, today())
      .then((data) => setSummary({ ...data, items: data.items ?? [] }))
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Stock Summary</h1>
          <p className="mt-1 text-sm text-navy/60">
            Computed current stock, low-stock flags, and consumption over the range.
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

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : !summary || summary.items.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">No items to summarize yet.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                <th className="px-5 py-3">Item</th>
                <th className="px-5 py-3">Current stock</th>
                <th className="px-5 py-3">Par level</th>
                <th className="px-5 py-3">Consumed ({summary.from} – {summary.to})</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.map((it) => (
                <tr key={it.item_id} className="border-b border-navy/5 last:border-0">
                  <td className="px-5 py-3 font-medium text-navy">{it.item_name}</td>
                  <td className="px-5 py-3 text-navy/80">
                    {it.current_stock} {it.unit}
                  </td>
                  <td className="px-5 py-3 text-navy/50">
                    {it.par_level} {it.unit}
                  </td>
                  <td className="px-5 py-3 text-navy/50">
                    {it.consumed_in_range != null ? `${it.consumed_in_range} ${it.unit}` : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {it.low_stock ? (
                      <span className="rounded-full bg-coral/10 px-2.5 py-1 text-xs font-medium text-coral">
                        Low stock
                      </span>
                    ) : (
                      <span className="rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
