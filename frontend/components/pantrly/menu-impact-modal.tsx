"use client";

import { useEffect, useState } from "react";
import { api as menulyApi, CompositionEntry } from "@/lib/menuly/api";
import { Modal } from "@/components/admin/ui/modal";

export function MenuImpactModal({
  itemId,
  itemName,
  unit,
  onClose,
}: {
  itemId: string | null;
  itemName: string;
  unit: string;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<CompositionEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    menulyApi
      .listComposition()
      .then((data) => setEntries((data ?? []).filter((e) => e.pantrly_item_id === itemId)))
      .finally(() => setLoading(false));
  }, [itemId]);

  return (
    <Modal open={itemId != null} onClose={onClose} title={`Menu impact — ${itemName}`}>
      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-navy/40">
          No menu items use this ingredient in their recipe yet — running out wouldn&apos;t affect the menu.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-navy/60">
            If {itemName} runs out, these {entries.length === 1 ? "dish" : `${entries.length} dishes`} can&apos;t be
            made:
          </p>
          <table className="w-full text-sm">
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-navy/5 last:border-0">
                  <td className="py-1.5 font-medium text-navy">{e.item_name}</td>
                  <td className="py-1.5 text-right text-navy/50">
                    uses {e.quantity_per_order} {unit} / order
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
