"use client";

import { PnlSummary } from "@/lib/ledgerly/api";
import { Card } from "@/components/admin/ui/card";

// Validated categorical slots, reused from the trend chart plus a few more
// from the same fixed 8-hue theme — sankey nodes carry a direct text label,
// so exact hue distinctness matters less here than in the trend chart.
const COLOR_CASH = "#2a78d6";
const COLOR_CARD = "#eb6834";
const COLOR_UPI = "#1baf7a";
const COLOR_OTHER_REVENUE = "#eda100";
const COLOR_EXPENSES = "#e87ba4";
const COLOR_PURCHASES = "#4a3aa7";
const COLOR_ADVANCES = "#9085e9";
const COLOR_SALARY = "#184f95";
// Status colors — reused from the trend chart's loss/profit convention.
const COLOR_GOOD = "#0ca30c";
const COLOR_LOSS = "#d03b3b";

function compactINR(cents: number): string {
  const rupees = cents / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}k`;
  return `₹${rupees.toFixed(0)}`;
}

type Node = { label: string; value: number; color: string };

function layoutColumn(nodes: Node[], plotH: number, minH: number, gap: number) {
  const usableH = plotH - gap * (nodes.length - 1);
  const total = nodes.reduce((s, n) => s + n.value, 0);
  const naive = nodes.map((n) => (total > 0 ? (n.value / total) * usableH : 0));
  const clamped = naive.map((h) => h < minH);
  const reserved = clamped.filter(Boolean).length * minH;
  const remainingH = Math.max(0, usableH - reserved);
  const remainingValue = nodes.reduce((s, n, i) => s + (clamped[i] ? 0 : n.value), 0);

  let y = 0;
  return nodes.map((n, i) => {
    const h = clamped[i] ? minH : remainingValue > 0 ? (n.value / remainingValue) * remainingH : 0;
    const node = { ...n, y0: y, y1: y + h };
    y += h + gap;
    return node;
  });
}

function ribbonPath(x0: number, y0top: number, y0bot: number, x1: number, y1top: number, y1bot: number) {
  const midX = (x0 + x1) / 2;
  return `M${x0},${y0top} C${midX},${y0top} ${midX},${y1top} ${x1},${y1top} L${x1},${y1bot} C${midX},${y1bot} ${midX},${y0bot} ${x0},${y0bot} Z`;
}

const WIDTH = 720;
const PLOT_H = 320;
const PAD_TOP = 36;
const PAD_SIDE = 130;
const NODE_W = 14;
const MIN_NODE_H = 14;
const GAP = 8;

export function PnlSankey({ summary }: { summary: PnlSummary }) {
  const loss = summary.profit_cents < 0 ? -summary.profit_cents : 0;
  const surplus = summary.profit_cents > 0 ? summary.profit_cents : 0;

  const sources: Node[] = [
    { label: "Cash", value: summary.revenue_cash_cents, color: COLOR_CASH },
    { label: "Card", value: summary.revenue_card_cents, color: COLOR_CARD },
    { label: "UPI", value: summary.revenue_upi_cents, color: COLOR_UPI },
    { label: "Other income", value: summary.revenue_other_cents, color: COLOR_OTHER_REVENUE },
    { label: "Owner's contribution", value: loss, color: COLOR_LOSS },
  ].filter((n) => n.value > 0);

  const destinations: Node[] = [
    { label: "Expenses", value: summary.payments_cents, color: COLOR_EXPENSES },
    { label: "Pantrly deliveries", value: summary.purchases_cents, color: COLOR_PURCHASES },
    { label: "Advances", value: summary.advances_cents, color: COLOR_ADVANCES },
    { label: "Salary (accrued)", value: summary.salary_cents, color: COLOR_SALARY },
    { label: "Profit", value: surplus, color: COLOR_GOOD },
  ].filter((n) => n.value > 0);

  const total = sources.reduce((s, n) => s + n.value, 0);
  if (total === 0 || sources.length === 0 || destinations.length === 0) return null;

  const srcNodes = layoutColumn(sources, PLOT_H, MIN_NODE_H, GAP);
  const dstNodes = layoutColumn(destinations, PLOT_H, MIN_NODE_H, GAP);
  const hubNodes = srcNodes; // hub's left edge mirrors the source stacking 1:1 (pure pass-through)
  const hubRightNodes = layoutColumn(destinations, PLOT_H, MIN_NODE_H, GAP);

  const xSrc = PAD_SIDE;
  const xHub = WIDTH / 2 - NODE_W / 2;
  const xDst = WIDTH - PAD_SIDE - NODE_W;

  return (
    <Card className="mt-4 p-5">
      <div className="mb-1">
        <h3 className="font-semibold text-navy">Where the money came from, where it went</h3>
        <p className="mt-0.5 text-xs text-navy/50">
          {summary.from} – {summary.to}
          {loss > 0 && " — a loss period, shown as the owner covering the gap"}
        </p>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${PLOT_H + PAD_TOP + 20}`} className="w-full" role="img" aria-label="Sankey diagram of income sources and expense destinations">
        <text x={WIDTH / 2} y={20} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-navy)" opacity={0.7}>
          Total {compactINR(total)}
        </text>

        {/* Source -> hub ribbons */}
        {srcNodes.map((n, i) => (
          <path
            key={`s2h-${n.label}`}
            d={ribbonPath(xSrc + NODE_W, PAD_TOP + n.y0, PAD_TOP + n.y1, xHub, PAD_TOP + hubNodes[i].y0, PAD_TOP + hubNodes[i].y1)}
            fill={n.color}
            fillOpacity={0.35}
          />
        ))}
        {/* Hub -> destination ribbons */}
        {dstNodes.map((n, i) => (
          <path
            key={`h2d-${n.label}`}
            d={ribbonPath(xHub + NODE_W, PAD_TOP + hubRightNodes[i].y0, PAD_TOP + hubRightNodes[i].y1, xDst, PAD_TOP + n.y0, PAD_TOP + n.y1)}
            fill={n.color}
            fillOpacity={0.35}
          />
        ))}

        {/* Source nodes + labels */}
        {srcNodes.map((n) => (
          <g key={n.label}>
            <rect x={xSrc} y={PAD_TOP + n.y0} width={NODE_W} height={Math.max(1, n.y1 - n.y0)} rx={2} fill={n.color} />
            <text x={xSrc - 8} y={PAD_TOP + (n.y0 + n.y1) / 2} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--color-navy)">
              {n.label}
            </text>
            <text
              x={xSrc - 8}
              y={PAD_TOP + (n.y0 + n.y1) / 2 + 13}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="var(--color-navy)"
              opacity={0.5}
            >
              {compactINR(n.value)}
            </text>
          </g>
        ))}

        {/* Hub node */}
        <rect x={xHub} y={PAD_TOP} width={NODE_W} height={PLOT_H} rx={2} fill="var(--color-navy)" fillOpacity={0.85} />

        {/* Destination nodes + labels */}
        {dstNodes.map((n) => (
          <g key={n.label}>
            <rect x={xDst} y={PAD_TOP + n.y0} width={NODE_W} height={Math.max(1, n.y1 - n.y0)} rx={2} fill={n.color} />
            <text x={xDst + NODE_W + 8} y={PAD_TOP + (n.y0 + n.y1) / 2} dominantBaseline="middle" fontSize={11} fill="var(--color-navy)">
              {n.label}
            </text>
            <text
              x={xDst + NODE_W + 8}
              y={PAD_TOP + (n.y0 + n.y1) / 2 + 13}
              dominantBaseline="middle"
              fontSize={10}
              fill="var(--color-navy)"
              opacity={0.5}
            >
              {compactINR(n.value)}
            </text>
          </g>
        ))}
      </svg>
    </Card>
  );
}
