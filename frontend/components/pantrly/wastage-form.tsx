"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input, Label } from "@/components/admin/ui/input";

export type WastageFormValue = {
  quantity: number;
  reason: string;
  wastage_date: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function WastageForm({
  unit,
  onSubmit,
  onCancel,
}: {
  unit: string;
  onSubmit: (value: WastageFormValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ quantity: qty, reason, wastage_date: date });
    } catch {
      setError("Failed to log wastage.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="wastage-qty">Quantity wasted</Label>
          <div className="flex items-center gap-2">
            <Input
              id="wastage-qty"
              type="number"
              step="any"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              autoFocus
              className="flex-1"
            />
            <span className="whitespace-nowrap rounded-lg bg-navy/5 px-2.5 py-2 text-sm text-navy/50">
              {unit}
            </span>
          </div>
        </div>
        <div>
          <Label htmlFor="wastage-date">Date</Label>
          <Input
            id="wastage-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="wastage-reason">Reason</Label>
        <Input
          id="wastage-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Spoilt, expired, dropped..."
        />
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          Log wastage
        </Button>
      </div>
    </form>
  );
}
