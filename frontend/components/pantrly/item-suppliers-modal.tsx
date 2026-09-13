"use client";

import { useEffect, useState } from "react";
import { api, ItemSupplier } from "@/lib/pantrly/api";
import { Modal } from "@/components/admin/ui/modal";
import { IconButton } from "@/components/admin/ui/icon-button";
import { TrashIcon } from "@/components/admin/ui/icons";

export function ItemSuppliersModal({
  itemId,
  itemName,
  onClose,
}: {
  itemId: string | null;
  itemName: string;
  onClose: () => void;
}) {
  const [suppliers, setSuppliers] = useState<ItemSupplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function load(currentItemId: string) {
    setLoading(true);
    return api
      .listItemSuppliers(currentItemId)
      .then((data) => setSuppliers(data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!itemId) return;
    load(itemId);
  }, [itemId]);

  async function handleRemove(supplierId: string) {
    if (!itemId) return;
    if (!confirm("Remove this supplier from the item? This cannot be undone.")) return;
    setRemovingId(supplierId);
    try {
      await api.removeItemSupplier(itemId, supplierId);
      await load(itemId);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Modal open={itemId != null} onClose={onClose} title={`Suppliers — ${itemName}`}>
      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : suppliers.length === 0 ? (
        <p className="text-sm text-navy/40">No suppliers linked to this item yet.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.supplier_id} className="border-b border-navy/5 last:border-0">
                <td className="py-1.5 font-medium text-navy">{s.name}</td>
                <td className="py-1.5 text-right text-navy/50">{s.phone || "No phone on file"}</td>
                <td className="py-1.5 text-right">
                  <IconButton
                    variant="danger"
                    onClick={() => handleRemove(s.supplier_id)}
                    disabled={removingId === s.supplier_id}
                    aria-label="Remove supplier"
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
