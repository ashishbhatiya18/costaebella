"use client";

import { useEffect, useMemo, useState } from "react";
import { api as ledgerlyApi, Sale } from "@/lib/ledgerly/api";
import { api as menulyApi, CompositionEntry } from "@/lib/menuly/api";
import { api as pantrlyApi, ItemStock } from "@/lib/pantrly/api";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { formatINR } from "@/lib/admin/format";
import { usePageTitle } from "@/lib/admin/use-page-title";

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

type DishStats = {
  name: string;
  orders: number;
  grossSalesCents: number;
};

export default function MenulyAnalyticsPage() {
  usePageTitle("Menu Analytics");
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [sales, setSales] = useState<Sale[]>([]);
  const [composition, setComposition] = useState<CompositionEntry[]>([]);
  const [stock, setStock] = useState<ItemStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      ledgerlyApi.listSales({ from, to }),
      menulyApi.listComposition(),
      pantrlyApi.stockSummaryRange(from, to),
    ])
      .then(([salesData, compositionData, stockData]) => {
        setSales(salesData ?? []);
        setComposition(compositionData ?? []);
        setStock(stockData.items ?? []);
      })
      .finally(() => setLoading(false));
  }, [from, to]);

  const { dishes, untaggedCount } = useMemo(() => {
    const byName = new Map<string, DishStats>();
    let untagged = 0;
    for (const s of sales) {
      const names = s.item_names ?? [];
      if (names.length === 0) {
        untagged++;
        continue;
      }
      for (const name of names) {
        const existing = byName.get(name) ?? { name, orders: 0, grossSalesCents: 0 };
        existing.orders += 1;
        existing.grossSalesCents += s.amount_cents;
        byName.set(name, existing);
      }
    }
    return {
      dishes: [...byName.values()].sort((a, b) => b.orders - a.orders),
      untaggedCount: untagged,
    };
  }, [sales]);

  // Expected consumption per Pantrly item = sum over every tagged dish of
  // (orders for that dish × its recipe quantity_per_order), compared
  // against Pantrly's actual counted consumption for the same range.
  const reconciliation = useMemo(() => {
    const ordersByDish = new Map(dishes.map((d) => [d.name, d.orders]));
    const expectedByPantrlyItem = new Map<
      string,
      { pantrlyItemName: string; unit: string; expected: number }
    >();
    for (const entry of composition) {
      const orders = ordersByDish.get(entry.item_name);
      if (!orders) continue;
      const existing = expectedByPantrlyItem.get(entry.pantrly_item_id) ?? {
        pantrlyItemName: entry.pantrly_item_name,
        unit: entry.pantrly_unit,
        expected: 0,
      };
      existing.expected += orders * entry.quantity_per_order;
      expectedByPantrlyItem.set(entry.pantrly_item_id, existing);
    }

    const stockByItemId = new Map(stock.map((s) => [s.item_id, s]));
    const rows = [...expectedByPantrlyItem.entries()].map(([pantrlyItemId, e]) => {
      const actual = stockByItemId.get(pantrlyItemId)?.consumed_in_range ?? null;
      const varianceOverExpectedPct = actual != null && e.expected > 0 ? ((actual - e.expected) / e.expected) * 100 : null;
      return {
        pantrlyItemId,
        pantrlyItemName: e.pantrlyItemName,
        unit: e.unit,
        expected: e.expected,
        actual,
        varianceOverExpectedPct,
      };
    });
    rows.sort((a, b) => (b.varianceOverExpectedPct ?? -Infinity) - (a.varianceOverExpectedPct ?? -Infinity));
    return rows;
  }, [dishes, composition, stock]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Menu Analytics</h1>
          <p className="mt-1 text-sm text-navy/60">
            Per-dish popularity from Ledgerly&apos;s tagged sales entries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          <span className="text-navy/40">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
        </div>
      </div>

      <Card className="mb-4 p-4">
        <p className="text-xs text-navy/60">
          &quot;Revenue&quot; below is the total of every sale that included the dish, not a true per-dish split —
          a sale tagged with multiple dishes counts its full amount toward each one. Use it as a popularity
          signal (orders count), not an exact per-dish P&amp;L.
          {untaggedCount > 0 && (
            <> {untaggedCount} sale{untaggedCount === 1 ? "" : "s"} in this range weren&apos;t tagged with a dish and are excluded.</>
          )}
        </p>
      </Card>

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : dishes.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">No tagged sales in this range yet.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                <th className="px-5 py-3">Dish</th>
                <th className="px-5 py-3">Orders</th>
                <th className="px-5 py-3">Revenue (orders incl. this dish)</th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((d) => (
                <tr key={d.name} className="border-b border-navy/5 last:border-0">
                  <td className="px-5 py-3 font-medium text-navy">{d.name}</td>
                  <td className="px-5 py-3 text-navy/70">{d.orders}</td>
                  <td className="px-5 py-3 text-navy/70">{formatINR(d.grossSalesCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-8 mb-4">
        <h2 className="font-display text-xl text-navy">Consumption Reconciliation</h2>
        <p className="mt-1 text-sm text-navy/60">
          Expected ingredient usage (from tagged sales × each dish&apos;s recipe) vs. what Pantrly actually
          counted as consumed over the same range. Large positive variance suggests waste, un-tagged
          comps/spoilage, or portioning bigger than the recipe — a way to spot where margin is leaking.
        </p>
      </div>

      {!loading && reconciliation.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">
          No recipes defined yet — add ingredient composition to dishes on the Menu Items tab to enable
          this.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                <th className="px-5 py-3">Pantrly item</th>
                <th className="px-5 py-3">Expected (from sales)</th>
                <th className="px-5 py-3">Actual (Pantrly counted)</th>
                <th className="px-5 py-3">Variance</th>
              </tr>
            </thead>
            <tbody>
              {reconciliation.map((row) => (
                <tr key={row.pantrlyItemId} className="border-b border-navy/5 last:border-0">
                  <td className="px-5 py-3 font-medium text-navy">{row.pantrlyItemName}</td>
                  <td className="px-5 py-3 text-navy/70">
                    {row.expected.toFixed(2)} {row.unit}
                  </td>
                  <td className="px-5 py-3 text-navy/70">
                    {row.actual != null ? `${row.actual.toFixed(2)} ${row.unit}` : "not counted this range"}
                  </td>
                  <td className="px-5 py-3">
                    {row.varianceOverExpectedPct == null ? (
                      <span className="text-navy/40">—</span>
                    ) : (
                      <span
                        className={
                          row.varianceOverExpectedPct > 15
                            ? "font-medium text-coral"
                            : row.varianceOverExpectedPct < -15
                              ? "font-medium text-amber-600"
                              : "text-navy/70"
                        }
                      >
                        {row.varianceOverExpectedPct > 0 ? "+" : ""}
                        {row.varianceOverExpectedPct.toFixed(0)}%
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
