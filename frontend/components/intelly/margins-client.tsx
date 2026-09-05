"use client";

import { useEffect, useMemo, useState } from "react";
import { api as ledgerlyApi, Sale } from "@/lib/ledgerly/api";
import { api as menulyApi, CompositionEntry } from "@/lib/menuly/api";
import { api as pantrlyApi, Purchase, ItemStock } from "@/lib/pantrly/api";
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
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

type DishMargin = {
  name: string;
  orders: number;
  priceCents: number | null;
  estCostPerOrderCents: number | null;
  estMarginPerOrderCents: number | null;
  marginPct: number | null;
};

export function MarginsClient({ prices }: { prices: Record<string, number> }) {
  usePageTitle("Margins");
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [sales, setSales] = useState<Sale[]>([]);
  const [composition, setComposition] = useState<CompositionEntry[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stock, setStock] = useState<ItemStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      ledgerlyApi.listSales({ from, to }),
      menulyApi.listComposition(),
      // Wide lookback for cost averaging — ingredient prices don't move
      // day to day, so pooling more purchases gives a steadier unit cost
      // than whatever happens to have been bought in the selected range.
      pantrlyApi.listPurchases({ from: daysAgo(180), to: today() }),
      pantrlyApi.stockSummaryRange(from, to),
    ]).then(([salesData, compositionData, purchasesData, stockData]) => {
      setSales(salesData ?? []);
      setComposition(compositionData ?? []);
      setPurchases(purchasesData ?? []);
      setStock(stockData.items ?? []);
    }).finally(() => setLoading(false));
  }, [from, to]);

  const avgUnitCostByPantrlyItem = useMemo(() => {
    const costSum = new Map<string, number>();
    const qtySum = new Map<string, number>();
    for (const p of purchases) {
      if (p.cost_cents == null) continue;
      costSum.set(p.item_id, (costSum.get(p.item_id) ?? 0) + p.cost_cents);
      qtySum.set(p.item_id, (qtySum.get(p.item_id) ?? 0) + p.quantity);
    }
    const out = new Map<string, number>();
    for (const [itemId, cost] of costSum) {
      const qty = qtySum.get(itemId) ?? 0;
      if (qty > 0) out.set(itemId, cost / qty);
    }
    return out;
  }, [purchases]);

  const { dishMargins, ordersByDish } = useMemo(() => {
    const orders = new Map<string, number>();
    for (const s of sales) {
      for (const name of s.item_names ?? []) {
        orders.set(name, (orders.get(name) ?? 0) + 1);
      }
    }

    const compositionByDish = new Map<string, CompositionEntry[]>();
    for (const entry of composition) {
      const list = compositionByDish.get(entry.item_name) ?? [];
      list.push(entry);
      compositionByDish.set(entry.item_name, list);
    }

    const rows: DishMargin[] = [...orders.entries()].map(([name, orderCount]) => {
      const priceRupees = prices[name];
      const priceCents = priceRupees != null ? Math.round(priceRupees * 100) : null;
      const recipe = compositionByDish.get(name);

      let estCostPerOrderCents: number | null = null;
      if (recipe && recipe.length > 0) {
        let cost = 0;
        let allKnown = true;
        for (const entry of recipe) {
          const unitCost = avgUnitCostByPantrlyItem.get(entry.pantrly_item_id);
          if (unitCost == null) {
            allKnown = false;
            break;
          }
          cost += unitCost * entry.quantity_per_order;
        }
        estCostPerOrderCents = allKnown ? Math.round(cost) : null;
      }

      const estMarginPerOrderCents =
        priceCents != null && estCostPerOrderCents != null ? priceCents - estCostPerOrderCents : null;
      const marginPct =
        estMarginPerOrderCents != null && priceCents ? (estMarginPerOrderCents / priceCents) * 100 : null;

      return { name, orders: orderCount, priceCents, estCostPerOrderCents, estMarginPerOrderCents, marginPct };
    });

    rows.sort((a, b) => b.orders - a.orders);
    return { dishMargins: rows, ordersByDish: orders };
  }, [sales, composition, prices, avgUnitCostByPantrlyItem]);

  const consumptionOverage = useMemo(() => {
    const expectedByPantrlyItem = new Map<string, { name: string; unit: string; expected: number }>();
    for (const entry of composition) {
      const orders = ordersByDish.get(entry.item_name);
      if (!orders) continue;
      const existing = expectedByPantrlyItem.get(entry.pantrly_item_id) ?? {
        name: entry.pantrly_item_name,
        unit: entry.pantrly_unit,
        expected: 0,
      };
      existing.expected += orders * entry.quantity_per_order;
      expectedByPantrlyItem.set(entry.pantrly_item_id, existing);
    }
    const stockByItemId = new Map(stock.map((s) => [s.item_id, s]));
    const rows = [...expectedByPantrlyItem.entries()]
      .map(([itemId, e]) => {
        const actual = stockByItemId.get(itemId)?.consumed_in_range ?? null;
        const overagePct = actual != null && e.expected > 0 ? ((actual - e.expected) / e.expected) * 100 : null;
        return { itemId, name: e.name, unit: e.unit, expected: e.expected, actual, overagePct };
      })
      .filter((r) => r.overagePct != null && r.overagePct > 0)
      .sort((a, b) => (b.overagePct ?? 0) - (a.overagePct ?? 0));
    return rows.slice(0, 5);
  }, [composition, ordersByDish, stock]);

  const thinMarginPopular = dishMargins
    .filter((d) => d.marginPct != null && d.marginPct < 20)
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Margins</h1>
          <p className="mt-1 text-sm text-navy/60">
            Estimated per-dish margin (menu price minus recipe-derived ingredient cost) and where Pantrly
            consumption is running ahead of what orders would explain.
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
          Margins are estimates: ingredient cost per order comes from a dish&apos;s recipe (set in Menuly) ×
          the average purchase cost of each ingredient over the last 180 days — not exact FIFO costing.
          Dishes with no recipe or price show as &quot;—&quot;.
        </p>
      </Card>

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : (
        <>
          {thinMarginPopular.length > 0 && (
            <Card className="mb-4 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-navy/50">
                Popular but thin-margin (&lt;20%)
              </p>
              <div className="flex flex-wrap gap-2">
                {thinMarginPopular.map((d) => (
                  <span key={d.name} className="rounded-full bg-coral/10 px-2.5 py-1 text-xs font-medium text-coral">
                    {d.name} — {d.marginPct?.toFixed(0)}% ({d.orders} orders)
                  </span>
                ))}
              </div>
            </Card>
          )}

          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                  <th className="px-5 py-3">Dish</th>
                  <th className="px-5 py-3">Orders</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">Est. cost/order</th>
                  <th className="px-5 py-3">Est. margin/order</th>
                  <th className="px-5 py-3">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {dishMargins.map((d) => (
                  <tr key={d.name} className="border-b border-navy/5 last:border-0">
                    <td className="px-5 py-3 font-medium text-navy">{d.name}</td>
                    <td className="px-5 py-3 text-navy/70">{d.orders}</td>
                    <td className="px-5 py-3 text-navy/70">{d.priceCents != null ? formatINR(d.priceCents) : "—"}</td>
                    <td className="px-5 py-3 text-navy/70">
                      {d.estCostPerOrderCents != null ? formatINR(d.estCostPerOrderCents) : "—"}
                    </td>
                    <td className="px-5 py-3 text-navy/70">
                      {d.estMarginPerOrderCents != null ? formatINR(d.estMarginPerOrderCents) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {d.marginPct == null ? (
                        <span className="text-navy/40">—</span>
                      ) : (
                        <span className={d.marginPct < 20 ? "font-medium text-coral" : "text-navy/70"}>
                          {d.marginPct.toFixed(0)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {dishMargins.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-navy/50">
                      No tagged sales in this range yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <div className="mt-8 mb-4">
            <h2 className="font-display text-xl text-navy">Top Consumption Overages</h2>
            <p className="mt-1 text-sm text-navy/60">
              Pantrly items where actual counted consumption ran well ahead of what tagged orders imply —
              waste, portioning drift, or un-tagged usage eating into margin.
            </p>
          </div>
          {consumptionOverage.length === 0 ? (
            <Card className="p-10 text-center text-navy/50">No overages detected for this range.</Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                    <th className="px-5 py-3">Pantrly item</th>
                    <th className="px-5 py-3">Expected</th>
                    <th className="px-5 py-3">Actual</th>
                    <th className="px-5 py-3">Overage</th>
                  </tr>
                </thead>
                <tbody>
                  {consumptionOverage.map((row) => (
                    <tr key={row.itemId} className="border-b border-navy/5 last:border-0">
                      <td className="px-5 py-3 font-medium text-navy">{row.name}</td>
                      <td className="px-5 py-3 text-navy/70">
                        {row.expected.toFixed(2)} {row.unit}
                      </td>
                      <td className="px-5 py-3 text-navy/70">
                        {row.actual?.toFixed(2)} {row.unit}
                      </td>
                      <td className="px-5 py-3 font-medium text-coral">+{row.overagePct?.toFixed(0)}%</td>
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
