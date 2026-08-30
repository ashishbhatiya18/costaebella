"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, Item, StockLog } from "@/lib/pantrly/api";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { usePageTitle } from "@/lib/admin/use-page-title";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const isToday = dateStr === today();
  return isToday
    ? `Today, ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function LogStockPage() {
  usePageTitle("Log Stock");
  const [items, setItems] = useState<Item[]>([]);
  const [date, setDate] = useState(today());
  const [editingDate, setEditingDate] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [field, setField] = useState<"opening" | "closing">("opening");
  const [quantity, setQuantity] = useState("");
  const [logs, setLogs] = useState<Record<string, StockLog>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listItems().then((data) => setItems(data ?? []));
  }, []);

  async function refreshLogs() {
    try {
      const data = await api.listStockLogs({ from: date, to: date });
      const map: Record<string, StockLog> = {};
      for (const l of data ?? []) {
        map[l.item_id] = l;
      }
      setLogs(map);
    } catch {
      setLogs({});
    }
  }

  useEffect(() => {
    refreshLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const selectedLog = selectedId ? logs[selectedId] : undefined;

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
      await api.logStock({ item_id: selected.id, date, field, quantity: qty });
      setQuantity("");
      setSelectedId(null);
      await refreshLogs();
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
            Record an opening or closing count for an item.
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
            {formatDateLabel(date)}
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

        <div className="max-h-72 space-y-1 overflow-y-auto">
          {filteredItems.map((it) => {
            const log = logs[it.id];
            const hasOpening = log?.opening_qty != null;
            const hasClosing = log?.closing_qty != null;
            return (
              <button
                key={it.id}
                onClick={() => {
                  setSelectedId(it.id);
                  setField(hasOpening ? "closing" : "opening");
                  setQuantity("");
                  setError(null);
                }}
                className={
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors " +
                  (selectedId === it.id ? "bg-teal/10 text-teal" : "hover:bg-navy/5")
                }
              >
                <span>
                  {it.name} <span className="text-navy/40">({it.unit})</span>
                </span>
                <span className="flex gap-1 text-xs">
                  <span className={hasOpening ? "text-teal" : "text-navy/30"}>Opening</span>
                  <span className="text-navy/20">/</span>
                  <span className={hasClosing ? "text-teal" : "text-navy/30"}>Closing</span>
                </span>
              </button>
            );
          })}
          {filteredItems.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-navy/50">No items found.</p>
          )}
        </div>
      </Card>

      {selected && (
        <Card className="mt-4 p-5">
          <h3 className="font-semibold text-navy">{selected.name}</h3>
          <p className="mt-1 text-xs text-navy/50">
            {selectedLog?.opening_qty != null && `Opening logged: ${selectedLog.opening_qty} ${selected.unit}`}
            {selectedLog?.opening_qty != null && selectedLog?.closing_qty != null && " · "}
            {selectedLog?.closing_qty != null && `Closing logged: ${selectedLog.closing_qty} ${selected.unit}`}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <SegmentedControl
              options={[
                { label: "Opening", value: "opening" },
                { label: "Closing", value: "closing" },
              ]}
              value={field}
              onChange={setField}
            />
            <Input
              type="number"
              step="any"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`Quantity (${selected.unit})`}
              className="w-40"
            />
            <Button onClick={submit} disabled={submitting}>
              Save
            </Button>
          </div>

          {error && <p className="mt-2 text-sm text-coral">{error}</p>}
        </Card>
      )}
    </div>
  );
}
