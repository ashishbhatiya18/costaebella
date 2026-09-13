"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input, Label } from "@/components/admin/ui/input";
import { ApiError } from "@/lib/pantrly/api";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function LogStockForm({
  unit,
  currentEstimate,
  onSubmit,
  onCancel,
}: {
  unit: string;
  currentEstimate: number | null;
  onSubmit: (quantity: number, date: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!quantity || isNaN(qty) || qty < 0) {
      setError("Enter a valid quantity.");
      return;
    }
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
            onChange={(e) => setQuantity(e.target.value)}
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
