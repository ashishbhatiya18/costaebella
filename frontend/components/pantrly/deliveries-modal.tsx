"use client";

import { useEffect, useState } from "react";
import { api, Purchase } from "@/lib/pantrly/api";
import { Modal } from "@/components/admin/ui/modal";
import { IconButton } from "@/components/admin/ui/icon-button";
import { TrashIcon } from "@/components/admin/ui/icons";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function DeliveriesModal({
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
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load(currentItemId: string) {
    setLoading(true);
    return api
      .listPurchases({ item_id: currentItemId, from: daysAgo(90), to: daysAgo(0) })
      .then((data) => setPurchases(data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!itemId) return;
    load(itemId);
  }, [itemId]);

  async function handleDelete(id: string) {
    if (!itemId) return;
    if (!confirm("Delete this delivery? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.deletePurchase(id);
      await load(itemId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal open={itemId != null} onClose={onClose} title={`Deliveries — ${itemName}`}>
      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : purchases.length === 0 ? (
        <p className="text-sm text-navy/40">No deliveries recorded in the last 90 days.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} className="border-b border-navy/5 last:border-0">
                <td className="py-1.5 text-navy/70">{p.purchase_date}</td>
                <td className="py-1.5 text-right font-medium text-navy">
                  {p.quantity} {unit}
                </td>
                <td className="py-1.5 text-right text-navy/40">{p.notes || ""}</td>
                <td className="py-1.5 text-right">
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
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
