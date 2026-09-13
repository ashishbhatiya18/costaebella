"use client";

import { useEffect, useMemo, useState } from "react";
import { api, Item, Purchase, Supplier } from "@/lib/pantrly/api";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { IconButton } from "@/components/admin/ui/icon-button";
import { TrashIcon } from "@/components/admin/ui/icons";
import { formatINR } from "@/lib/admin/format";
import { usePageTitle } from "@/lib/admin/use-page-title";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Mirrors the backend's week/month bucketing (Stock Summary's rangeBounds)
// so "this week"/"this month" mean the same thing across Pantrly.
function rangeBounds(filter: "day" | "week" | "month", anchorDate: string): { from: string; to: string } {
  const anchor = new Date(anchorDate + "T00:00:00");
  if (filter === "day") {
    return { from: anchorDate, to: anchorDate };
  }
  if (filter === "week") {
    const offset = (anchor.getDay() + 6) % 7;
    const start = new Date(anchor);
    start.setDate(start.getDate() - offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { from: toDateStr(start), to: toDateStr(end) };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { from: toDateStr(start), to: toDateStr(end) };
}

export default function DeliveriesPage() {
  usePageTitle("Past Deliveries");
  const [filter, setFilter] = useState<"day" | "week" | "month">("week");
  const [anchorDate, setAnchorDate] = useState(today());
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { from, to } = useMemo(() => rangeBounds(filter, anchorDate), [filter, anchorDate]);

  async function load() {
    setLoading(true);
    try {
      const [purchasesData, itemsData, suppliersData] = await Promise.all([
        api.listPurchases({ from, to }),
        api.listItems(),
        api.listSuppliers(),
      ]);
      setPurchases(purchasesData ?? []);
      setItems(itemsData ?? []);
      setSuppliers(suppliersData ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [from, to]);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  const sortedPurchases = useMemo(
    () => [...purchases].sort((a, b) => b.purchase_date.localeCompare(a.purchase_date)),
    [purchases],
  );

  const filteredPurchases = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedPurchases;
    return sortedPurchases.filter((p) => {
      const itemName = itemById.get(p.item_id)?.name ?? "";
      const supplierName = p.supplier_id ? supplierById.get(p.supplier_id)?.name ?? "" : "";
      return itemName.toLowerCase().includes(q) || supplierName.toLowerCase().includes(q);
    });
  }, [sortedPurchases, search, itemById, supplierById]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this delivery? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.deletePurchase(id);
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Past Deliveries</h1>
          <p className="mt-1 text-sm text-navy/60">
            All recorded deliveries across items and suppliers ({from} – {to}).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="date"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            className="w-auto"
          />
          <SegmentedControl
            options={[
              { label: "Day", value: "day" },
              { label: "Week", value: "week" },
              { label: "Month", value: "month" },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </div>

      <div className="mb-4 max-w-sm">
        <Input
          type="search"
          placeholder="Search item or supplier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : sortedPurchases.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">No deliveries recorded in this range.</Card>
      ) : filteredPurchases.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">No deliveries match &ldquo;{search}&rdquo;.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Item</th>
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3">Quantity</th>
                <th className="px-5 py-3">Cost</th>
                <th className="px-5 py-3">Notes</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((p) => {
                const item = itemById.get(p.item_id);
                const supplier = p.supplier_id ? supplierById.get(p.supplier_id) : null;
                return (
                  <tr key={p.id} className="border-b border-navy/5 last:border-0">
                    <td className="px-5 py-3 text-navy/70">{p.purchase_date}</td>
                    <td className="px-5 py-3 font-medium text-navy">{item?.name ?? "Unknown item"}</td>
                    <td className="px-5 py-3 text-navy/70">{supplier?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-navy/80">
                      {p.quantity} {item?.unit ?? ""}
                    </td>
                    <td className="px-5 py-3 text-navy/50">
                      {p.cost_cents != null ? formatINR(p.cost_cents) : "—"}
                    </td>
                    <td className="px-5 py-3 text-navy/40">{p.notes || ""}</td>
                    <td className="px-5 py-3 text-right">
                      <IconButton
                        variant="danger"
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        aria-label="Delete delivery"
                      >
                        <TrashIcon />
                      </IconButton>
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
