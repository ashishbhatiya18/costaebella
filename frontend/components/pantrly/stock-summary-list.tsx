"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { api, Item, ItemStock, StockSummaryResponse } from "@/lib/pantrly/api";
import { api as ledgerlyApi } from "@/lib/ledgerly/api";
import { api as menulyApi } from "@/lib/menuly/api";
import { Card } from "@/components/admin/ui/card";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { ActionsMenu } from "@/components/admin/ui/actions-menu";
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

type Status = "low_stock" | "needs_count" | "ok";

function statusOf(it: ItemStock, level: "fresh" | "due" | "overdue"): Status {
  if (it.low_stock) return "low_stock";
  if (level === "overdue") return "needs_count";
  return "ok";
}

const STATUS_ORDER: Status[] = ["low_stock", "needs_count", "ok"];

const STATUS_GROUPS: Record<
  Status,
  { label: string; badgeClass: string; badgeLabel: string; headerClass: string; rowClass: string }
> = {
  low_stock: {
    label: "Low stock",
    badgeClass: "bg-coral/10 text-coral",
    badgeLabel: "Low stock",
    headerClass: "bg-coral/10 text-coral",
    rowClass: "bg-coral/[0.04] hover:bg-coral/[0.08]",
  },
  needs_count: {
    label: "Needs count",
    badgeClass: "bg-amber-100 text-amber-700",
    badgeLabel: "Needs count",
    headerClass: "bg-amber-100/60 text-amber-700",
    rowClass: "bg-amber-50/60 hover:bg-amber-100/60",
  },
  ok: {
    label: "OK",
    badgeClass: "bg-teal/10 text-teal",
    badgeLabel: "OK",
    headerClass: "bg-teal/10 text-teal",
    rowClass: "hover:bg-navy/5",
  },
};

export function StockSummaryList({
  search,
  items,
  onEdit,
  onDelete,
  onLogStock,
  onStockLogs,
  onDelivery,
  onDeliveries,
  onWastage,
  onWastageHistory,
  onAddSupplier,
  onSuppliersHistory,
  onPriceTrend,
  onMenuImpact,
}: {
  search: string;
  items: Item[];
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onLogStock: (item: Item) => void;
  onStockLogs: (item: Item) => void;
  onDelivery: (item: Item) => void;
  onDeliveries: (item: Item) => void;
  onWastage: (item: Item) => void;
  onWastageHistory: (item: Item) => void;
  onAddSupplier: (item: Item) => void;
  onSuppliersHistory: (item: Item) => void;
  onPriceTrend: (item: Item) => void;
  onMenuImpact: (item: Item) => void;
}) {
  const [range, setRange] = useState<"week" | "month">("week");
  const [summary, setSummary] = useState<StockSummaryResponse | null>(null);
  const [expected, setExpected] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string; unit: string } | null>(null);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = summary?.items ?? [];
    if (!q) return items;
    return items.filter((it) => it.item_name.toLowerCase().includes(q));
  }, [summary, search]);

  const grouped = useMemo(() => {
    const groups: Record<Status, ItemStock[]> = { low_stock: [], needs_count: [], ok: [] };
    for (const it of filteredItems) {
      const level = staleness(daysSince(it.last_log_date));
      groups[statusOf(it, level)].push(it);
    }
    return groups;
  }, [filteredItems]);

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-navy/60">
          Computed current stock, low-stock flags, and consumption over the range.
        </p>
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
      ) : filteredItems.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">No items match &ldquo;{search}&rdquo;.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                <th className="whitespace-nowrap px-4 py-3">Item</th>
                <th className="whitespace-nowrap px-4 py-3">Stock / Order below</th>
                <th className="whitespace-nowrap px-4 py-3">Consumed</th>
                <th className="whitespace-nowrap px-4 py-3">Expected</th>
                <th className="whitespace-nowrap px-4 py-3">Last counted</th>
                <th className="whitespace-nowrap px-4 py-3">Status</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {STATUS_ORDER.filter((status) => grouped[status].length > 0).map((status) => (
                <Fragment key={status}>
                  <tr className={STATUS_GROUPS[status].headerClass}>
                    <td colSpan={7} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide">
                      {STATUS_GROUPS[status].label} ({grouped[status].length})
                    </td>
                  </tr>
                  {grouped[status].map((it) => {
                    const days = daysSince(it.last_log_date);
                    const level = staleness(days);
                    const expectedQty = expected.get(it.item_id) ?? null;
                    const fullItem = itemById.get(it.item_id);
                    return (
                      <tr
                        key={it.item_id}
                        className={
                          "cursor-pointer border-b border-navy/5 last:border-0 " +
                          STATUS_GROUPS[status].rowClass
                        }
                        onClick={() =>
                          setSelectedItem({ id: it.item_id, name: it.item_name, unit: it.unit })
                        }
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-navy underline-offset-2 hover:underline">
                          {it.item_name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-navy/80">
                          {it.current_stock} / {it.par_level} {it.unit}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-navy/50">
                          {it.consumed_in_range != null ? `${it.consumed_in_range} ${it.unit}` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-navy/50">
                          {expectedQty != null ? `${expectedQty.toFixed(2)} ${it.unit}` : "—"}
                        </td>
                        <td className={"whitespace-nowrap px-4 py-3 font-medium " + STALENESS_CLASSES[level]}>
                          {countLabel(days)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={
                              "rounded-full px-2.5 py-1 text-xs font-medium " +
                              STATUS_GROUPS[status].badgeClass
                            }
                          >
                            {STATUS_GROUPS[status].badgeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {fullItem && (
                            <ActionsMenu
                              options={[
                                { label: "Edit item", onClick: () => onEdit(fullItem) },
                                { label: "Add Stock Count", onClick: () => onLogStock(fullItem) },
                                { label: "View Stock Counts", onClick: () => onStockLogs(fullItem) },
                                { label: "Add delivery", onClick: () => onDelivery(fullItem) },
                                { label: "Deliveries", onClick: () => onDeliveries(fullItem) },
                                { label: "Price trend", onClick: () => onPriceTrend(fullItem) },
                                { label: "Add wastage", onClick: () => onWastage(fullItem) },
                                { label: "Wastage", onClick: () => onWastageHistory(fullItem) },
                                { label: "Suppliers", onClick: () => onSuppliersHistory(fullItem) },
                                { label: "Add supplier", onClick: () => onAddSupplier(fullItem) },
                                { label: "Menu impact", onClick: () => onMenuImpact(fullItem) },
                                { label: "Delete item", onClick: () => onDelete(fullItem.id), variant: "danger" },
                              ]}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
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
