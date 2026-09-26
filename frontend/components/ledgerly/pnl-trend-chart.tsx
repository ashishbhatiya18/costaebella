"use client";

import { useState } from "react";
import { PnlTrendPoint } from "@/lib/ledgerly/api";
import { Card } from "@/components/admin/ui/card";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";

// Validated categorical slots (blue/orange/aqua) — the first three from the
// design system's default theme, which pass all-pairs CVD/contrast checks
// for exactly 3 series (unlike the brand navy/teal/coral, which fail the
// chroma-floor check as chart marks).
const COLOR_REVENUE = "#2a78d6";
const COLOR_EXPENSES = "#eb6834";
const COLOR_PROFIT = "#1baf7a";
// Status colors (fixed, never themed) — reserved for flagging whether a
// period was profitable or a loss, distinct from the three categorical
// series colors above.
const COLOR_GOOD = "#0ca30c";
const COLOR_LOSS = "#d03b3b";

function compactINR(cents: number): string {
  const rupees = cents / 100;
  const sign = rupees < 0 ? "-" : "";
  const abs = Math.abs(rupees);
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}k`;
  return `${sign}₹${abs.toFixed(0)}`;
}

function periodLabel(point: PnlTrendPoint, rangeType: "week" | "month"): string {
  const from = new Date(point.from + "T00:00:00");
  if (rangeType === "month") {
    return from.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  }
  const to = new Date(point.to + "T00:00:00");
  const sameMonth = from.getMonth() === to.getMonth();
  const fromStr = from.toLocaleDateString("en-IN", { day: "numeric", month: sameMonth ? undefined : "short" });
  const toStr = to.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${fromStr}–${toStr}`;
}

const WIDTH = 720;
const HEIGHT = 292;
const PAD_LEFT = 56;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 44;

export function PnlTrendChart({
  points,
  rangeType,
}: {
  points: PnlTrendPoint[];
  rangeType: "week" | "month";
}) {
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (points.length === 0) return null;

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const allValues = points.flatMap((p) => [p.revenue_cents, p.expenses_cents, p.profit_cents]);
  const maxValue = Math.max(0, ...allValues);
  const minValue = Math.min(0, ...allValues);
  const domain = maxValue - minValue || 1;

  const yFor = (cents: number) => PAD_TOP + plotH - ((cents - minValue) / domain) * plotH;
  const zeroY = yFor(0);

  const n = points.length;
  const xFor = (i: number) => PAD_LEFT + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const groupWidth = plotW / n;

  const gridLines = 4;
  const gridValues = Array.from({ length: gridLines + 1 }, (_, i) => minValue + (domain * i) / gridLines);

  function lineFor(key: "revenue_cents" | "expenses_cents" | "profit_cents") {
    return points.map((p, i) => `${xFor(i)},${yFor(p[key])}`).join(" ");
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <Card className="mt-4 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-navy">Income, expenses &amp; profit trend</h3>
          <p className="mt-0.5 text-xs text-navy/50">
            Last {points.length} {rangeType === "week" ? "weeks" : "months"}
          </p>
        </div>
        <SegmentedControl
          options={[
            { label: "Line", value: "line" },
            { label: "Bar", value: "bar" },
          ]}
          value={chartType}
          onChange={setChartType}
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-navy/70">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_REVENUE }} />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_EXPENSES }} />
          Expenses
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_PROFIT }} />
          Profit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOR_GOOD, opacity: 0.5 }} />
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOR_LOSS, opacity: 0.5 }} />
          Profitable / loss period
        </span>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Income, expenses and profit trend chart">
          {points.map((p, i) => (
            <rect
              key={`swimlane-${p.from}`}
              x={xFor(i) - groupWidth / 2}
              y={PAD_TOP}
              width={groupWidth}
              height={plotH}
              fill={p.profit_cents < 0 ? COLOR_LOSS : COLOR_GOOD}
              fillOpacity={0.07}
            />
          ))}
          {gridValues.map((v, i) => (
            <g key={i}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={yFor(v)}
                y2={yFor(v)}
                stroke="var(--color-navy)"
                strokeOpacity={0.08}
                strokeWidth={1}
              />
              <text x={PAD_LEFT - 8} y={yFor(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--color-navy)" opacity={0.5}>
                {compactINR(v)}
              </text>
            </g>
          ))}
          {minValue < 0 && (
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={zeroY} y2={zeroY} stroke="var(--color-navy)" strokeOpacity={0.25} strokeWidth={1} />
          )}

          {points.map((p, i) => {
            const isLoss = p.profit_cents < 0;
            return (
              <text
                key={p.from}
                x={xFor(i)}
                y={HEIGHT - PAD_BOTTOM + 18}
                textAnchor="middle"
                fontSize={rangeType === "week" ? 9 : 10}
                fontWeight={700}
                fill={isLoss ? COLOR_LOSS : COLOR_GOOD}
              >
                {periodLabel(p, rangeType)}
              </text>
            );
          })}

          {chartType === "line" ? (
            <>
              {(
                [
                  ["revenue_cents", COLOR_REVENUE],
                  ["expenses_cents", COLOR_EXPENSES],
                  ["profit_cents", COLOR_PROFIT],
                ] as const
              ).map(([key, color]) => (
                <polyline key={key} points={lineFor(key)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {points.map((p, i) => (
                <g key={p.from}>
                  {(
                    [
                      ["revenue_cents", COLOR_REVENUE],
                      ["expenses_cents", COLOR_EXPENSES],
                      ["profit_cents", COLOR_PROFIT],
                    ] as const
                  ).map(([key, color]) => {
                    const isLossPoint = key === "profit_cents" && p[key] < 0;
                    return (
                      <circle
                        key={key}
                        cx={xFor(i)}
                        cy={yFor(p[key])}
                        r={isLossPoint ? 5 : 4}
                        fill={isLossPoint ? COLOR_LOSS : color}
                        stroke={isLossPoint ? "white" : "none"}
                        strokeWidth={isLossPoint ? 1.5 : 0}
                      />
                    );
                  })}
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
            </>
          ) : (
            points.map((p, i) => {
              const barW = (groupWidth - 12) / 3;
              const groupStart = xFor(i) - groupWidth / 2 + 4;
              const bars = [
                ["revenue_cents", COLOR_REVENUE],
                ["expenses_cents", COLOR_EXPENSES],
                ["profit_cents", COLOR_PROFIT],
              ] as const;
              return (
                <g key={p.from}>
                  {bars.map(([key, color], bi) => {
                    const v = p[key];
                    const y = Math.min(yFor(v), zeroY);
                    const h = Math.max(1, Math.abs(yFor(v) - zeroY));
                    const isLossBar = key === "profit_cents" && v < 0;
                    return (
                      <rect
                        key={key}
                        x={groupStart + bi * (barW + 2)}
                        y={y}
                        width={barW}
                        height={h}
                        rx={2}
                        fill={isLossBar ? COLOR_LOSS : color}
                      />
                    );
                  })}
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
              );
            })
          )}
        </svg>

        {hovered && (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-navy/10 bg-white px-3 py-2 text-xs shadow-md">
            <p className="font-medium text-navy">
              {hovered.from} – {hovered.to}
            </p>
            <p className="mt-1" style={{ color: COLOR_REVENUE }}>
              Income: {compactINR(hovered.revenue_cents)}
            </p>
            <p style={{ color: COLOR_EXPENSES }}>Expenses: {compactINR(hovered.expenses_cents)}</p>
            <p style={{ color: hovered.profit_cents < 0 ? COLOR_LOSS : COLOR_PROFIT }} className={hovered.profit_cents < 0 ? "font-semibold" : undefined}>
              Profit: {compactINR(hovered.profit_cents)}
              {hovered.profit_cents < 0 && " (loss)"}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
