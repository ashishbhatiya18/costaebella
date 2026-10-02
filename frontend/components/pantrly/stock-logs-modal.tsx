"use client";

import { useEffect, useState } from "react";
import { api, StockLog } from "@/lib/pantrly/api";
import { Modal } from "@/components/admin/ui/modal";
import { StockLogsTable } from "@/components/pantrly/stock-logs-table";
import { daysAgoStr } from "@/lib/admin/period";

export function StockLogsModal({
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
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load(currentItemId: string) {
    setLoading(true);
    return api
      .listStockLogs({ item_id: currentItemId, from: daysAgoStr(90), to: daysAgoStr(0) })
      .then((data) => setLogs((data ?? []).slice().reverse()))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!itemId) return;
    load(itemId);
  }, [itemId]);

  async function handleDelete(id: string) {
    if (!itemId) return;
    if (!confirm("Delete this stock count? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.deleteStockLog(id);
      await load(itemId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal open={itemId != null} onClose={onClose} title={`Stock counts — ${itemName}`}>
      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : (
        <StockLogsTable logs={logs} unit={unit} onDelete={handleDelete} deletingId={deletingId} />
      )}
    </Modal>
  );
}
