"use client";

import { useEffect, useMemo, useState } from "react";
import { api, Item, Purchase } from "@/lib/pantrly/api";
import { Modal } from "@/components/admin/ui/modal";
import { IconButton } from "@/components/admin/ui/icon-button";
import { TrashIcon } from "@/components/admin/ui/icons";
import { daysAgoStr } from "@/lib/admin/period";
import { formatDate } from "@/lib/admin/format";

export function SupplierDeliveriesModal({
  supplierId,
  supplierName,
  items,
  onClose,
  onChange,
}: {
  supplierId: string | null;
  supplierName: string;
  items: Item[];
  onClose: () => void;
  onChange?: () => void;
}) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  function load() {
    setLoading(true);
    return api
      .listPurchases({ from: daysAgoStr(90), to: daysAgoStr(0) })
      .then((data) => setPurchases(data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!supplierId) return;
    load();
  }, [supplierId]);

  const supplierPurchases = purchases
    .filter((p) => p.supplier_id === supplierId)
    .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));

  async function handleDelete(id: string) {
    if (!confirm("Delete this delivery? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.deletePurchase(id);
      await load();
      onChange?.();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal open={supplierId != null} onClose={onClose} title={`Deliveries — ${supplierName}`}>
      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : supplierPurchases.length === 0 ? (
        <p className="text-sm text-navy/40">No deliveries recorded in the last 90 days.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {supplierPurchases.map((p) => {
              const item = itemById.get(p.item_id);
              return (
                <tr key={p.id} className="border-b border-navy/5 last:border-0">
                  <td className="py-1.5 text-navy/70">{formatDate(p.purchase_date)}</td>
                  <td className="py-1.5 font-medium text-navy">{item?.name ?? "Unknown item"}</td>
                  <td className="py-1.5 text-right text-navy/80">
                    {p.quantity} {item?.unit ?? ""}
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
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
