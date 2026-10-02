"use client";

import { useEffect, useState } from "react";
import { api, Purchase, StockLog } from "@/lib/pantrly/api";
import { Modal } from "@/components/admin/ui/modal";
import { daysAgoStr, periodLabel } from "@/lib/admin/period";
import { formatDate } from "@/lib/admin/format";

// Buckets are keyed by their display label — "28 Sep – 4 Oct 2026" (the
// Monday-start week every admin page uses) or "Oct 2026" — which is unique
// per period, so it doubles as the grouping key.
function weekLabel(dateStr: string) {
  return periodLabel("week", dateStr);
}

function monthLabel(dateStr: string) {
  return periodLabel("month", dateStr);
}

type Bucket = { label: string; consumed: number };

function bucketConsumption(
  countedLogs: { date: string; qty: number }[],
  purchases: Purchase[],
  labelFor: (date: string) => string,
): Bucket[] {
  const buckets = new Map<string, number>();
  for (let i = 1; i < countedLogs.length; i++) {
    const prev = countedLogs[i - 1];
    const curr = countedLogs[i];
    const purchased = purchases
      .filter((p) => p.purchase_date > prev.date && p.purchase_date <= curr.date)
      .reduce((sum, p) => sum + p.quantity, 0);
    const consumed = prev.qty + purchased - curr.qty;
    const label = labelFor(curr.date);
    buckets.set(label, (buckets.get(label) ?? 0) + consumed);
  }
  return Array.from(buckets.entries()).map(([label, consumed]) => ({ label, consumed }));
}

export function ItemDetailModal({
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
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    const from = daysAgoStr(90);
    const to = daysAgoStr(0);
    Promise.all([
      api.listStockLogs({ item_id: itemId, from, to }),
      api.listPurchases({ item_id: itemId, from, to }),
    ])
      .then(([logsData, purchasesData]) => {
        setLogs(logsData ?? []);
        setPurchases(purchasesData ?? []);
      })
      .finally(() => setLoading(false));
  }, [itemId]);

  const countedLogs = logs
    .map((l) => ({ date: l.log_date, qty: l.closing_qty ?? l.opening_qty }))
    .filter((l): l is { date: string; qty: number } => l.qty != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const weekly = bucketConsumption(countedLogs, purchases, weekLabel).slice(-8);
  const monthly = bucketConsumption(countedLogs, purchases, monthLabel).slice(-6);

  return (
    <Modal open={itemId != null} onClose={onClose} title={itemName}>
      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : (
        <div className="space-y-6">
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-navy/50">
              Weekly consumption
            </h4>
            {weekly.length === 0 ? (
              <p className="text-sm text-navy/40">Not enough counted logs yet.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {weekly.map((b) => (
                    <tr key={b.label} className="border-b border-navy/5 last:border-0">
                      <td className="py-1.5 text-navy/70">{b.label}</td>
                      <td className="py-1.5 text-right font-medium text-navy">
                        {b.consumed.toFixed(2)} {unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-navy/50">
              Monthly consumption
            </h4>
            {monthly.length === 0 ? (
              <p className="text-sm text-navy/40">Not enough counted logs yet.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {monthly.map((b) => (
                    <tr key={b.label} className="border-b border-navy/5 last:border-0">
                      <td className="py-1.5 text-navy/70">{b.label}</td>
                      <td className="py-1.5 text-right font-medium text-navy">
                        {b.consumed.toFixed(2)} {unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-navy/50">
              Orders (last 90 days)
            </h4>
            {purchases.length === 0 ? (
              <p className="text-sm text-navy/40">No deliveries recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b border-navy/5 last:border-0">
                      <td className="py-1.5 text-navy/70">{formatDate(p.purchase_date)}</td>
                      <td className="py-1.5 text-right font-medium text-navy">
                        {p.quantity} {unit}
                      </td>
                      <td className="py-1.5 text-right text-navy/40">{p.notes || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
