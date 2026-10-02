"use client";

import { useState } from "react";
import { ExpenseTrendMonth } from "@/lib/ledgerly/api";
import { Card } from "@/components/admin/ui/card";
import { compactINR } from "@/components/ledgerly/pnl-trend-chart";

// Same validated three categorical slots (blue/orange/aqua) as
// PnlTrendChart, so the two Ledgerly charts read as one system.
const COLOR_REVENUE = "#2a78d6";
const COLOR_GROCERY = "#eb6834";
const COLOR_SALARY = "#1baf7a";

const SERIES = [
  { key: "revenue_cents", label: "Income", color: COLOR_REVENUE },
  { key: "grocery_cents", label: "Grocery", color: COLOR_GROCERY },
  { key: "salary_earned_cents", label: "Salary (earned)", color: COLOR_SALARY },
] as const;

const WIDTH = 720;
const HEIGHT = 260;
const PAD_LEFT = 56;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 36;

export function monthLabel(from: string): string {
  return new Date(from + "T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export function ExpenseTrendChart({ months }: { months: ExpenseTrendMonth[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  if (months.length === 0) return null;

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const maxValue = Math.max(1, ...months.flatMap((m) => SERIES.map((s) => m[s.key])));

  const yFor = (cents: number) => PAD_TOP + plotH - (cents / maxValue) * plotH;
  const n = months.length;
  const xFor = (i: number) => PAD_LEFT + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const groupWidth = plotW / n;
  const gridValues = Array.from({ length: 5 }, (_, i) => (maxValue * i) / 4);
  const hovered = hoverIndex !== null ? months[hoverIndex] : null;

  return (
    <Card className="p-5">
      <div className="mb-3">
        <h3 className="font-semibold text-navy">Grocery &amp; salary vs income</h3>
        <p className="mt-0.5 text-xs text-navy/50">Month on month</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-navy/70">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Grocery, salary and income trend chart">
          {gridValues.map((v, i) => (
            <g key={i}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yFor(v)} y2={yFor(v)} stroke="var(--color-navy)" strokeOpacity={0.08} strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={yFor(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--color-navy)" opacity={0.5}>
                {compactINR(v)}
              </text>
            </g>
          ))}

          {months.map((m, i) => (
            <text key={m.from} x={xFor(i)} y={HEIGHT - PAD_BOTTOM + 18} textAnchor="middle" fontSize={10} fill="var(--color-navy)" opacity={0.6}>
              {monthLabel(m.from)}
            </text>
          ))}

          {SERIES.map((s) => (
            <polyline
              key={s.key}
              points={months.map((m, i) => `${xFor(i)},${yFor(m[s.key])}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {months.map((m, i) => (
            <g key={m.from}>
              {hoverIndex === i && (
                <line x1={xFor(i)} x2={xFor(i)} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke="var(--color-navy)" strokeOpacity={0.15} strokeWidth={1} />
              )}
              {SERIES.map((s) => (
                <circle key={s.key} cx={xFor(i)} cy={yFor(m[s.key])} r={4} fill={s.color} />
              ))}
              <rect
                x={xFor(i) - groupWidth / 2}
                y={PAD_TOP}
                width={groupWidth}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            </g>
          ))}
        </svg>

        {hovered && (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-navy/10 bg-white px-3 py-2 text-xs shadow-md">
            <p className="font-medium text-navy">{monthLabel(hovered.from)}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="mt-0.5" style={{ color: s.color }}>
                {s.label}: {compactINR(hovered[s.key])}
              </p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
