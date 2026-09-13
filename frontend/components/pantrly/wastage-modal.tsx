"use client";

import { useEffect, useState } from "react";
import { api, WastageLog } from "@/lib/pantrly/api";
import { Modal } from "@/components/admin/ui/modal";
import { IconButton } from "@/components/admin/ui/icon-button";
import { TrashIcon } from "@/components/admin/ui/icons";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function WastageModal({
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
  const [logs, setLogs] = useState<WastageLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load(currentItemId: string) {
    setLoading(true);
    return api
      .listWastage({ item_id: currentItemId, from: daysAgo(90), to: daysAgo(0) })
      .then((data) => setLogs(data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!itemId) return;
    load(itemId);
  }, [itemId]);

  async function handleDelete(id: string) {
    if (!itemId) return;
    if (!confirm("Delete this wastage log? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.deleteWastage(id);
      await load(itemId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal open={itemId != null} onClose={onClose} title={`Wastage — ${itemName}`}>
      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-navy/40">No wastage recorded in the last 90 days.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-navy/5 last:border-0">
                <td className="py-1.5 text-navy/70">{l.wastage_date}</td>
                <td className="py-1.5 text-right font-medium text-navy">
                  {l.quantity} {unit}
                </td>
                <td className="py-1.5 text-right text-navy/40">{l.reason || ""}</td>
                <td className="py-1.5 text-right">
                  <IconButton
                    variant="danger"
                    onClick={() => handleDelete(l.id)}
                    disabled={deletingId === l.id}
                    aria-label="Delete wastage log"
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
