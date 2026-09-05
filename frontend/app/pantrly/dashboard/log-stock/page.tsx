"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, ItemStock } from "@/lib/pantrly/api";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { usePageTitle } from "@/lib/admin/use-page-title";

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
  if (days === 0) return "Counted today";
  if (days === 1) return "Counted yesterday";
  return `Counted ${days} days ago`;
}

const STALENESS_CLASSES: Record<string, string> = {
  fresh: "text-teal",
  due: "text-amber-600",
  overdue: "text-coral",
};

export default function LogStockPage() {
  usePageTitle("Log Stock");
  const [items, setItems] = useState<ItemStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(today());
  const [editingDate, setEditingDate] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.stockSummary("week", today());
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Most overdue items surface first — that's what a weekly walk-through
  // needs to prioritize.
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const da = daysSince(a.last_log_date) ?? Infinity;
      const db = daysSince(b.last_log_date) ?? Infinity;
      return db - da;
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return sortedItems;
    const q = search.toLowerCase();
    return sortedItems.filter((i) => i.item_name.toLowerCase().includes(q));
  }, [sortedItems, search]);

  const selected = items.find((i) => i.item_id === selectedId) ?? null;

  async function submit() {
    if (!selected) return;
    const qty = Number(quantity);
    if (!quantity || isNaN(qty) || qty < 0) {
      setError("Enter a valid quantity.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.logStock({ item_id: selected.item_id, date, field: "closing", quantity: qty });
      setQuantity("");
      setSelectedId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to log stock.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Log Stock</h1>
          <p className="mt-1 text-sm text-navy/60">
            Weekly walk-through: count what&apos;s on hand for each item. Most overdue items are listed first.
          </p>
        </div>
        {editingDate ? (
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={() => setEditingDate(false)}
            autoFocus
            className="w-auto"
          />
        ) : (
          <button
            onClick={() => setEditingDate(true)}
            className="rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-sm font-medium text-navy hover:bg-sand/20"
          >
            {date === today() ? "Today" : date}
          </button>
        )}
      </div>

      <Card className="p-5">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
          className="mb-4"
        />

        {loading ? (
          <p className="px-3 py-6 text-center text-sm text-navy/50">Loading…</p>
        ) : (
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {filteredItems.map((it) => {
              const days = daysSince(it.last_log_date);
              const level = staleness(days);
              return (
                <button
                  key={it.item_id}
                  onClick={() => {
                    setSelectedId(it.item_id);
                    setQuantity("");
                    setError(null);
                  }}
                  className={
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors " +
                    (selectedId === it.item_id ? "bg-teal/10 text-teal" : "hover:bg-navy/5")
                  }
                >
                  <span>
                    {it.item_name} <span className="text-navy/40">({it.unit})</span>
                  </span>
                  <span className={"text-xs font-medium " + STALENESS_CLASSES[level]}>
                    {countLabel(days)}
                  </span>
                </button>
              );
            })}
            {filteredItems.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-navy/50">No items found.</p>
            )}
          </div>
        )}
      </Card>

      {selected && (
        <Card className="mt-4 p-5">
          <h3 className="font-semibold text-navy">{selected.item_name}</h3>
          <p className="mt-1 text-xs text-navy/50">
            Current estimate: {selected.current_stock} {selected.unit} · {countLabel(daysSince(selected.last_log_date))}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Input
              type="number"
              step="any"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`Quantity on hand (${selected.unit})`}
              className="w-56"
            />
            <Button onClick={submit} disabled={submitting}>
              Save count
            </Button>
          </div>

          {error && <p className="mt-2 text-sm text-coral">{error}</p>}
        </Card>
      )}
    </div>
  );
}
