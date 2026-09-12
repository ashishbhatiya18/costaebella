"use client";

import { useEffect, useState } from "react";
import { api, StockSummaryResponse } from "@/lib/pantrly/api";
import { api as ledgerlyApi } from "@/lib/ledgerly/api";
import { api as menulyApi } from "@/lib/menuly/api";
import { Card } from "@/components/admin/ui/card";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { usePageTitle } from "@/lib/admin/use-page-title";
import { ItemDetailModal } from "@/components/pantrly/item-detail-modal";

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Days since a YYYY-MM-DD date, or null if never counted.
function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr + "T00:00:00").getTime();
  const now = new Date(today() + "T00:00:00").getTime();
  return Math.round((now - then) / (1000 * 60 * 60 * 24));
}

function staleness(days: number | null): "fresh" | "due" | "overdue" {
  if (days == null || days >= 14) return "overdue";
  if (days >= 7) return "due";
  return "fresh";
}

function countLabel(days: number | null) {
  if (days == null) return "Never counted";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

const STALENESS_CLASSES: Record<string, string> = {
  fresh: "text-navy/50",
  due: "text-amber-600",
  overdue: "text-coral",
};

export default function StockSummaryPage() {
  usePageTitle("Stock Summary");
  const [range, setRange] = useState<"week" | "month">("week");
  const [summary, setSummary] = useState<StockSummaryResponse | null>(null);
  const [expected, setExpected] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string; unit: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .stockSummary(range, today())
      .then(async (data) => {
        const stockData = { ...data, items: data.items ?? [] };
        if (cancelled) return;
        setSummary(stockData);

        // Expected consumption = for every dish sold in this same window
        // (Ledgerly), how much of each Pantrly item its recipe (Menuly
        // composition) says it should have used — the counterpart to
        // consumed_in_range's "what was actually counted as used".
        const [sales, composition] = await Promise.all([
          ledgerlyApi.listSales({ from: stockData.from, to: stockData.to }),
          menulyApi.listComposition(),
        ]);
        if (cancelled) return;

        const ordersByDish = new Map<string, number>();
        for (const s of sales ?? []) {
          for (const name of s.item_names ?? []) {
            ordersByDish.set(name, (ordersByDish.get(name) ?? 0) + 1);
          }
        }
        const expectedByPantrlyItem = new Map<string, number>();
        for (const entry of composition ?? []) {
          const orders = ordersByDish.get(entry.item_name);
          if (!orders) continue;
          expectedByPantrlyItem.set(
            entry.pantrly_item_id,
            (expectedByPantrlyItem.get(entry.pantrly_item_id) ?? 0) + orders * entry.quantity_per_order,
          );
        }
        setExpected(expectedByPantrlyItem);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
                <th className="px-5 py-3">Expected (from orders)</th>
                <th className="px-5 py-3">Delta</th>
                <th className="px-5 py-3">Last counted</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.map((it) => {
                const days = daysSince(it.last_log_date);
                const level = staleness(days);
                const expectedQty = expected.get(it.item_id) ?? null;
                const delta = it.consumed_in_range != null && expectedQty != null
                  ? it.consumed_in_range - expectedQty
                  : null;
                return (
                  <tr
                    key={it.item_id}
                    className="cursor-pointer border-b border-navy/5 last:border-0 hover:bg-navy/5"
                    onClick={() =>
                      setSelectedItem({ id: it.item_id, name: it.item_name, unit: it.unit })
                    }
                  >
                    <td className="px-5 py-3 font-medium text-navy underline-offset-2 hover:underline">
                      {it.item_name}
                    </td>
                    <td className="px-5 py-3 text-navy/80">
                      {it.current_stock} {it.unit}
                    </td>
                    <td className="px-5 py-3 text-navy/50">
                      {it.par_level} {it.unit}
                    </td>
                    <td className="px-5 py-3 text-navy/50">
                      {it.consumed_in_range != null ? `${it.consumed_in_range} ${it.unit}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-navy/50">
                      {expectedQty != null ? `${expectedQty.toFixed(2)} ${it.unit}` : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {delta == null ? (
                        <span className="text-navy/40">—</span>
                      ) : (
                        <span
                          className={
                            delta > 0
                              ? "font-medium text-coral"
                              : delta < 0
                                ? "font-medium text-amber-600"
                                : "text-navy/50"
                          }
                        >
                          {delta > 0 ? "+" : ""}
                          {delta.toFixed(2)} {it.unit}
                        </span>
                      )}
                    </td>
                    <td className={"px-5 py-3 font-medium " + STALENESS_CLASSES[level]}>
                      {countLabel(days)}
                    </td>
                    <td className="px-5 py-3">
                      {it.low_stock ? (
                        <span className="rounded-full bg-coral/10 px-2.5 py-1 text-xs font-medium text-coral">
                          Low stock
                        </span>
                      ) : level === "overdue" ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                          Needs count
                        </span>
                      ) : (
                        <span className="rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal">
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <ItemDetailModal
        itemId={selectedItem?.id ?? null}
        itemName={selectedItem?.name ?? ""}
        unit={selectedItem?.unit ?? ""}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
