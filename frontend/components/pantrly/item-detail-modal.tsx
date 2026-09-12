"use client";

import { useEffect, useState } from "react";
import { api, Purchase, StockLog } from "@/lib/pantrly/api";
import { Modal } from "@/components/admin/ui/modal";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function isoWeekLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthLabel(dateStr: string) {
  return dateStr.slice(0, 7);
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
    let cancelled = false;
    setLoading(true);
    const from = daysAgo(90);
    const to = daysAgo(0);
    Promise.all([
      api.listStockLogs({ item_id: itemId, from, to }),
      api.listPurchases({ item_id: itemId, from, to }),
    ])
      .then(([logsData, purchasesData]) => {
        if (cancelled) return;
        setLogs(logsData ?? []);
        setPurchases(purchasesData ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const countedLogs = logs
    .map((l) => ({ date: l.log_date, qty: l.closing_qty ?? l.opening_qty }))
    .filter((l): l is { date: string; qty: number } => l.qty != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const weekly = bucketConsumption(countedLogs, purchases, isoWeekLabel).slice(-8);
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
                      <td className="py-1.5 text-navy/70">{p.purchase_date}</td>
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
