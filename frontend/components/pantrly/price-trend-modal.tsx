"use client";

import { useEffect, useMemo, useState } from "react";
import { api, Purchase } from "@/lib/pantrly/api";
import { Modal } from "@/components/admin/ui/modal";
import { formatINR } from "@/lib/admin/format";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

type Point = { date: string; unitPriceRupees: number; quantity: number; costCents: number };

const CHART_WIDTH = 480;
const CHART_HEIGHT = 140;
const PADDING = 20;

function buildPath(points: Point[], minPrice: number, maxPrice: number) {
  const range = maxPrice - minPrice || 1;
  const stepX = points.length > 1 ? (CHART_WIDTH - PADDING * 2) / (points.length - 1) : 0;
  return points.map((p, i) => {
    const x = PADDING + i * stepX;
    const y = PADDING + (CHART_HEIGHT - PADDING * 2) * (1 - (p.unitPriceRupees - minPrice) / range);
    return { x, y, point: p };
  });
}

export function PriceTrendModal({
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

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    api
      .listPurchases({ item_id: itemId, from: daysAgo(365), to: daysAgo(0) })
      .then((data) => setPurchases(data ?? []))
      .finally(() => setLoading(false));
  }, [itemId]);

  const points: Point[] = useMemo(() => {
    return purchases
      .filter((p) => p.cost_cents != null && p.quantity > 0)
      .map((p) => ({
        date: p.purchase_date,
        unitPriceRupees: p.cost_cents! / 100 / p.quantity,
        quantity: p.quantity,
        costCents: p.cost_cents!,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [purchases]);

  const minPrice = points.length ? Math.min(...points.map((p) => p.unitPriceRupees)) : 0;
  const maxPrice = points.length ? Math.max(...points.map((p) => p.unitPriceRupees)) : 0;
  const plotted = buildPath(points, minPrice, maxPrice);
  const linePath = plotted.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <Modal open={itemId != null} onClose={onClose} title={`Price trend — ${itemName}`}>
      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : points.length === 0 ? (
        <p className="text-sm text-navy/40">No costed deliveries in the last year.</p>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs text-navy/50">
              Cost per {unit} over the last year ({points.length} costed{" "}
              {points.length === 1 ? "delivery" : "deliveries"})
            </p>
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="w-full"
              role="img"
              aria-label={`Price trend for ${itemName}`}
            >
              {/* Recessive baseline only — no gridlines/ticks. */}
              <line
                x1={PADDING}
                y1={CHART_HEIGHT - PADDING}
                x2={CHART_WIDTH - PADDING}
                y2={CHART_HEIGHT - PADDING}
                stroke="currentColor"
                className="text-navy/10"
                strokeWidth={1}
              />
              {plotted.length > 1 && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="currentColor"
                  className="text-teal"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {plotted.map((p) => (
                <circle key={p.point.date + p.point.costCents} cx={p.x} cy={p.y} r={4} className="fill-teal">
                  <title>
                    {p.point.date}: {formatINR(Math.round(p.point.unitPriceRupees * 100))} / {unit}
                  </title>
                </circle>
              ))}
            </svg>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                <th className="py-1.5">Date</th>
                <th className="py-1.5 text-right">Quantity</th>
                <th className="py-1.5 text-right">Cost</th>
                <th className="py-1.5 text-right">Per {unit}</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.date + p.costCents} className="border-b border-navy/5 last:border-0">
                  <td className="py-1.5 text-navy/70">{p.date}</td>
                  <td className="py-1.5 text-right text-navy/70">
                    {p.quantity} {unit}
                  </td>
                  <td className="py-1.5 text-right text-navy/70">{formatINR(p.costCents)}</td>
                  <td className="py-1.5 text-right font-medium text-navy">
                    {formatINR(Math.round(p.unitPriceRupees * 100))}
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
