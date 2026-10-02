"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input, Label } from "@/components/admin/ui/input";
import { ApiError } from "@/lib/pantrly/api";
import { todayStr } from "@/lib/admin/period";
import { checkCount, CountWarning } from "@/lib/pantrly/count-check";

export function LogStockForm({
  unit,
  currentEstimate,
  typicalQty,
  onSubmit,
  onCancel,
}: {
  unit: string;
  currentEstimate: number | null;
  // The item's usual amount (recent counts, deliveries, par) — used to catch
  // a count typed in the wrong unit (e.g. grams on a kg item).
  typicalQty: number | null;
  onSubmit: (quantity: number, date: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(todayStr());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<CountWarning | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!quantity || isNaN(qty) || qty < 0) {
      setError("Enter a valid quantity.");
      return;
    }
    // Pause on a count far off the item's usual scale and ask first.
    const w = checkCount(qty, typicalQty, unit.trim());
    if (w) {
      setWarning(w);
      return;
    }
    await save(qty);
  }

  async function save(qty: number) {
    setWarning(null);
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(qty, date);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to log stock.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {currentEstimate != null && (
        <p className="text-xs text-navy/50">
          Current estimate: {currentEstimate} {unit}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="log-stock-qty">Quantity on hand</Label>
          <Input
            id="log-stock-qty"
            type="number"
            step="any"
            min={0}
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setWarning(null);
            }}
            placeholder={unit}
            required
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="log-stock-date">Date</Label>
          <Input
            id="log-stock-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      {warning && (
        <div className="rounded-xl border border-coral/30 bg-coral/5 p-3 text-sm">
          <p className="font-medium text-coral">
            {Number(quantity)} {unit.trim()} is{" "}
            {warning.ratio >= 1
              ? `${Math.round(warning.ratio)}×`
              : `1/${Math.round(1 / warning.ratio)} of`}{" "}
            the usual amount for this item (about {+warning.typical.toFixed(3)}{" "}
            {unit.trim()}).
          </p>
          <p className="mt-1 text-navy/70">
            {warning.suggestion != null
              ? warning.ratio >= 1
                ? "Was it weighed in grams or ml? This item is counted in " +
                  unit.trim() +
                  "."
                : "Was it entered in kg or litres? This item is counted in " +
                  unit.trim() +
                  "."
              : "Please check the number before saving."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {warning.suggestion != null && (
              <Button
                type="button"
                size="sm"
                disabled={submitting}
                onClick={() => {
                  setQuantity(String(warning.suggestion));
                  save(warning.suggestion!);
                }}
              >
                Use {warning.suggestion} {unit.trim()}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={submitting}
              onClick={() => save(Number(quantity))}
            >
              Save {Number(quantity)} {unit.trim()} anyway
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          Save count
        </Button>
      </div>
    </form>
  );
}
