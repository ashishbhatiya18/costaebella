"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input, Label } from "@/components/admin/ui/input";
import { Item } from "@/lib/pantrly/api";

export type ItemFormValue = {
  name: string;
  unit: string;
  category: string;
  par_level: number;
};

export function ItemForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: Item;
  onSubmit: (value: ItemFormValue) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [parLevel, setParLevel] = useState(String(initial?.par_level ?? 0));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name,
        unit,
        category,
        par_level: Number(parLevel) || 0,
      });
    } catch {
      setError("Failed to save item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="item-name">Name</Label>
        <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="item-unit">Unit</Label>
          <Input
            id="item-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="kg, l, pcs..."
            required
          />
        </div>
        <div>
          <Label htmlFor="item-category">Category</Label>
          <Input
            id="item-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Produce, Dairy..."
          />
        </div>
      </div>
      <div>
        <Label htmlFor="item-par">Par level (low-stock threshold)</Label>
        <Input
          id="item-par"
          type="number"
          step="any"
          min={0}
          value={parLevel}
          onChange={(e) => setParLevel(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
