"use client";

import { useEffect, useState } from "react";
import { api, SupplierItem } from "@/lib/pantrly/api";
import { Modal } from "@/components/admin/ui/modal";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

type Recommendation = {
  item: SupplierItem;
  currentStock: number;
  recommendedQty: number;
  basis: "last delivery" | "top up to order-below level";
};

export function SupplierRecommendationsModal({
  supplierId,
  supplierName,
  onClose,
}: {
  supplierId: string | null;
  supplierName: string;
  onClose: () => void;
}) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      api.listSupplierItems(supplierId),
      api.stockSummary("week", daysAgo(0)),
      // Two years back is generous enough to find a "last delivery" for
      // any item that's ever been ordered from this supplier, while still
      // being a single bounded query.
      api.listPurchases({ supplier_id: supplierId, from: daysAgo(730), to: daysAgo(0) }),
    ])
      .then(([supplierItems, stockData, purchases]) => {
        if (cancelled) return;
        const stockByItem = new Map((stockData.items ?? []).map((s) => [s.item_id, s.current_stock]));

        // Latest purchase per item (purchases already sorted purchase_date
        // DESC by the backend).
        const lastQtyByItem = new Map<string, number>();
        for (const p of purchases ?? []) {
          if (!lastQtyByItem.has(p.item_id)) lastQtyByItem.set(p.item_id, p.quantity);
        }

        const recs: Recommendation[] = [];
        for (const item of supplierItems ?? []) {
          const currentStock = stockByItem.get(item.item_id) ?? 0;
          if (currentStock >= item.par_level) continue; // only recommend when actually low

          const lastQty = lastQtyByItem.get(item.item_id);
          if (lastQty != null) {
            recs.push({ item, currentStock, recommendedQty: lastQty, basis: "last delivery" });
          } else {
            recs.push({
              item,
              currentStock,
              recommendedQty: Math.max(0, item.par_level - currentStock),
              basis: "top up to order-below level",
            });
          }
        }
        setRecommendations(recs);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  return (
    <Modal open={supplierId != null} onClose={onClose} title={`Recommended order — ${supplierName}`}>
      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : recommendations.length === 0 ? (
        <p className="text-sm text-navy/40">
          Nothing to reorder — all linked items are at or above their order-below level.
        </p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {recommendations.map((rec) => (
              <tr key={rec.item.item_id} className="border-b border-navy/5 last:border-0">
                <td className="py-1.5 font-medium text-navy">{rec.item.name}</td>
                <td className="py-1.5 text-right text-navy/50">
                  {rec.currentStock} / {rec.item.par_level} {rec.item.unit}
                </td>
                <td className="py-1.5 text-right font-medium text-navy">
                  {rec.recommendedQty} {rec.item.unit}
                </td>
                <td className="py-1.5 text-right text-xs text-navy/40">{rec.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
