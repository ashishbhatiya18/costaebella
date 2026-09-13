"use client";

import { useEffect, useState } from "react";
import { api, CompositionEntry } from "@/lib/menuly/api";
import { api as pantrlyApi, Item as PantrlyItem } from "@/lib/pantrly/api";
import { Modal } from "@/components/admin/ui/modal";
import { Button } from "@/components/admin/ui/button";
import { Input, Label } from "@/components/admin/ui/input";
import { getCompatibleUnits, convertToItemUnit } from "@/lib/pantrly/units";

export function CompositionModal({
  itemName,
  onClose,
}: {
  itemName: string;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<CompositionEntry[]>([]);
  const [pantrlyItems, setPantrlyItems] = useState<PantrlyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPantrlyItemId, setSelectedPantrlyItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [entryUnit, setEntryUnit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [comp, items] = await Promise.all([
        api.listComposition(itemName),
        pantrlyApi.listItems(),
      ]);
      setEntries(comp ?? []);
      setPantrlyItems(items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemName]);

  const usedIds = new Set(entries.map((e) => e.pantrly_item_id));
  const availableItems = pantrlyItems.filter((i) => !usedIds.has(i.id));
  const selected = availableItems.find((i) => i.id === selectedPantrlyItemId);
  const compatibleUnits = selected ? getCompatibleUnits(selected.unit) : [];

  function handleSelectItem(id: string) {
    setSelectedPantrlyItemId(id);
    const item = availableItems.find((i) => i.id === id);
    setEntryUnit(item?.unit ?? "");
  }

  async function addEntry() {
    const qty = Number(quantity);
    if (!selectedPantrlyItemId || !selected) {
      setError("Select a Pantrly item.");
      return;
    }
    if (!quantity || isNaN(qty) || qty <= 0) {
      setError("Enter a valid quantity.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Recipes are entered in whatever scale is natural (e.g. grams for a
      // pinch of something tracked in kg) but stored in the item's own
      // tracked unit, since that's what stock deduction/consumption math
      // elsewhere assumes.
      const qtyInItemUnit = convertToItemUnit(qty, entryUnit, selected.unit);
      await api.setComposition(itemName, selectedPantrlyItemId, qtyInItemUnit);
      setSelectedPantrlyItemId("");
      setQuantity("");
      setEntryUnit("");
      await load();
    } catch {
      setError("Failed to save.");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeEntry(id: string) {
    await api.deleteComposition(id);
    await load();
  }

  return (
    <Modal open onClose={onClose} title={`Recipe — ${itemName}`}>
      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : (
        <div className="space-y-4">
          {entries.length === 0 ? (
            <p className="text-sm text-navy/50">No ingredients defined yet.</p>
          ) : (
            <ul className="divide-y divide-navy/5">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-navy">
                    {e.pantrly_item_name}{" "}
                    <span className="text-navy/50">
                      — {e.quantity_per_order} {e.pantrly_unit} / order
                    </span>
                  </span>
                  <button
                    onClick={() => removeEntry(e.id)}
                    className="text-xs font-medium text-coral hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-end gap-2 border-t border-navy/10 pt-4">
            <div className="flex-1">
              <Label htmlFor="composition-item">Pantrly item</Label>
              <select
                id="composition-item"
                value={selectedPantrlyItemId}
                onChange={(e) => handleSelectItem(e.target.value)}
                className="w-full rounded-xl border border-navy/15 bg-cream/40 px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20"
              >
                <option value="">Select…</option>
                {availableItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-40">
              <Label htmlFor="composition-qty">Qty per order</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="composition-qty"
                  type="number"
                  step="any"
                  min={0}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="flex-1"
                  disabled={!selected}
                />
                {selected && compatibleUnits.length > 1 ? (
                  <select
                    value={entryUnit}
                    onChange={(e) => setEntryUnit(e.target.value)}
                    aria-label="Quantity unit"
                    className="rounded-lg border border-navy/15 bg-navy/5 px-2 py-2 text-sm text-navy/70 outline-none"
                  >
                    {compatibleUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                ) : (
                  selected && (
                    <span className="whitespace-nowrap rounded-lg bg-navy/5 px-2.5 py-2 text-sm text-navy/50">
                      {selected.unit}
                    </span>
                  )
                )}
              </div>
              {selected && entryUnit && entryUnit !== selected.unit && quantity && !isNaN(Number(quantity)) && (
                <p className="mt-1 text-xs text-navy/40">
                  = {convertToItemUnit(Number(quantity), entryUnit, selected.unit).toFixed(4)} {selected.unit}
                </p>
              )}
            </div>
            <Button onClick={addEntry} disabled={submitting}>
              Add
            </Button>
          </div>
          {error && <p className="text-sm text-coral">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
