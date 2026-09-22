"use client";

import { StockLog } from "@/lib/pantrly/api";
import { IconButton } from "@/components/admin/ui/icon-button";
import { TrashIcon } from "@/components/admin/ui/icons";

export function StockLogsTable({
  logs,
  unit,
  onDelete,
  deletingId,
}: {
  logs: StockLog[];
  unit: string;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-navy/40">No stock counts recorded in the last 90 days.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-navy/40">
          <th className="pb-1.5 font-medium">Date</th>
          <th className="pb-1.5 text-right font-medium">Opening</th>
          <th className="pb-1.5 text-right font-medium">Closing</th>
          {onDelete && <th className="pb-1.5" />}
        </tr>
      </thead>
      <tbody>
        {logs.map((l) => (
          <tr key={l.id} className="border-b border-navy/5 last:border-0">
            <td className="py-1.5 text-navy/70">{l.log_date}</td>
            <td className="py-1.5 text-right font-medium text-navy">
              {l.opening_qty != null ? `${l.opening_qty} ${unit}` : "—"}
            </td>
            <td className="py-1.5 text-right font-medium text-navy">
              {l.closing_qty != null ? `${l.closing_qty} ${unit}` : "—"}
            </td>
            {onDelete && (
              <td className="py-1.5 text-right">
                <IconButton
                  variant="danger"
                  onClick={() => onDelete(l.id)}
                  disabled={deletingId === l.id}
                  aria-label="Delete stock count"
                >
                  <TrashIcon />
                </IconButton>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
