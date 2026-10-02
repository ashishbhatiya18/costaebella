"use client";

import { useEffect, useMemo, useState } from "react";
import { api, Item, Purchase, Supplier } from "@/lib/pantrly/api";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { PeriodNavigator } from "@/components/admin/ui/period-navigator";
import { clsx } from "@/lib/admin/clsx";
import { formatDate } from "@/lib/admin/format";
import { usePageTitle } from "@/lib/admin/use-page-title";
import {
  periodBounds,
  periodLabel,
  shiftAnchor,
  todayStr,
} from "@/lib/admin/period";

// Item rate card: what each item has cost per unit, month by month, from
// costed deliveries — so a supplier's price hike shows up as soon as the
// first delivery at the new price is recorded. Computed on read from the
// deliveries list, nothing stored (same philosophy as the stock summary).
//
// A month's rate is quantity-weighted: total cost ÷ total quantity of that
// month's deliveries, so one small top-up at an odd price doesn't swing it.

// A rise of this much or more month-on-month is flagged as a price hike.
const HIKE_PCT = 10;
// Smaller moves are still coloured, but anything under this is noise.
const MOVE_PCT = 3;
// A jump this extreme is almost always a data-entry slip — the same item
// logged in different units across deliveries (e.g. 400 "g" one month, 2
// jars the next) — not a real price change, so it's flagged for checking
// instead of being reported as a hike.
const SUSPECT_UP_PCT = 100;
const SUSPECT_DOWN_PCT = -50;

// Within one month, two deliveries of the same item whose per-unit prices
// differ by this factor or more were almost certainly entered in different
// units (e.g. paneer as 500 "kg" one day and 1 kg the next) — which also
// makes that month's average rate meaningless.
const MIXED_UNITS_RATIO = 3;

function isSuspectMove(pct: number | null) {
  return pct != null && (pct >= SUSPECT_UP_PCT || pct <= SUSPECT_DOWN_PCT);
}

function needsCheck(r: Row) {
  return r.mixedUnits || isSuspectMove(r.changePct);
}

function isHike(r: Row) {
  return r.changePct != null && r.changePct >= HIKE_PCT && !needsCheck(r);
}

type MonthRate = {
  rate: number;
  qty: number;
  costCents: number;
  deliveries: number;
};

type Row = {
  item: Item;
  unit: string;
  months: (MonthRate | null)[];
  // Latest month with deliveries vs the closest earlier month with deliveries.
  changePct: number | null;
  // Some month in range has deliveries priced too far apart to share a unit.
  mixedUnits: boolean;
  latest: Purchase;
  latestSupplier: string | null;
};

type Filter = "all" | "changed" | "hikes" | "check";

function formatRate(rupees: number) {
  return rupees.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: rupees < 100 ? 2 : 0,
  });
}

function cleanUnit(unit: string) {
  return unit.trim() || "unit";
}

export default function RateCardPage() {
  usePageTitle("Rate Card");
  const [monthsShown, setMonthsShown] = useState<"3" | "6" | "12">("6");
  // Any date in the last (most recent) month shown.
  const [anchor, setAnchor] = useState(todayStr());
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // First-of-month for each month shown, oldest first.
  const monthStarts = useMemo(() => {
    const n = Number(monthsShown);
    return Array.from({ length: n }, (_, i) =>
      shiftAnchor("month", anchor, i - (n - 1)),
    );
  }, [anchor, monthsShown]);

  const from = monthStarts[0];
  const to = periodBounds("month", anchor).to;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.listPurchases({ from, to }),
      api.listItems(),
      api.listSuppliers(),
    ])
      .then(([purchasesData, itemsData, suppliersData]) => {
        if (cancelled) return;
        setPurchases(purchasesData ?? []);
        setItems(itemsData ?? []);
        setSuppliers(suppliersData ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const rows: Row[] = useMemo(() => {
    const itemById = new Map(items.map((i) => [i.id, i]));
    const supplierById = new Map(suppliers.map((s) => [s.id, s.name.trim()]));
    const monthIndex = new Map(monthStarts.map((m, i) => [m.slice(0, 7), i]));

    const byItem = new Map<string, Purchase[]>();
    for (const p of purchases) {
      if (p.cost_cents == null || !(p.quantity > 0)) continue;
      if (!itemById.has(p.item_id)) continue;
      const list = byItem.get(p.item_id) ?? [];
      list.push(p);
      byItem.set(p.item_id, list);
    }

    const out: Row[] = [];
    for (const [itemId, list] of byItem) {
      const item = itemById.get(itemId)!;
      const buckets = monthStarts.map(() => ({
        qty: 0,
        costCents: 0,
        deliveries: 0,
        minRate: Infinity,
        maxRate: 0,
      }));
      for (const p of list) {
        const i = monthIndex.get(p.purchase_date.slice(0, 7));
        if (i === undefined) continue;
        const unitRate = p.cost_cents! / p.quantity;
        buckets[i].qty += p.quantity;
        buckets[i].costCents += p.cost_cents!;
        buckets[i].deliveries += 1;
        buckets[i].minRate = Math.min(buckets[i].minRate, unitRate);
        buckets[i].maxRate = Math.max(buckets[i].maxRate, unitRate);
      }
      const mixedUnits = buckets.some(
        (b) => b.deliveries > 1 && b.maxRate / b.minRate >= MIXED_UNITS_RATIO,
      );
      const months = buckets.map((b) =>
        b.deliveries > 0
          ? {
              qty: b.qty,
              costCents: b.costCents,
              deliveries: b.deliveries,
              rate: b.costCents / 100 / b.qty,
            }
          : null,
      );

      const withData = months.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
      let changePct: number | null = null;
      if (withData.length >= 2) {
        const last = months[withData[withData.length - 1]]!;
        const prev = months[withData[withData.length - 2]]!;
        changePct = (last.rate / prev.rate - 1) * 100;
      }

      const latest = list.reduce((a, b) =>
        b.purchase_date > a.purchase_date ||
        (b.purchase_date === a.purchase_date &&
          (b.created_at ?? "") > (a.created_at ?? ""))
          ? b
          : a,
      );

      out.push({
        item,
        unit: cleanUnit(item.unit),
        months,
        changePct,
        mixedUnits,
        latest,
        latestSupplier: latest.supplier_id
          ? (supplierById.get(latest.supplier_id) ?? null)
          : null,
      });
    }

    // Biggest hikes first, then entries to check, then everything else
    // alphabetically.
    const rank = (r: Row) => (isHike(r) ? 0 : needsCheck(r) ? 1 : 2);
    return out.sort((a, b) => {
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      if (rank(a) === 0) return b.changePct! - a.changePct!;
      return a.item.name.trim().localeCompare(b.item.name.trim());
    });
  }, [purchases, items, suppliers, monthStarts]);

  const hikes = rows.filter(isHike);
  const suspects = rows.filter(needsCheck);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "hikes" && !isHike(r)) return false;
      if (filter === "check" && !needsCheck(r)) return false;
      if (filter === "changed" && Math.abs(r.changePct ?? 0) < MOVE_PCT)
        return false;
      if (!q) return true;
      return (
        r.item.name.toLowerCase().includes(q) ||
        (r.latestSupplier ?? "").toLowerCase().includes(q) ||
        r.item.category.toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Rate Card</h1>
          <p className="mt-1 max-w-2xl text-sm text-navy/60">
            What each item has cost per unit, month by month, from recorded
            deliveries (total cost ÷ total quantity). A rise of {HIKE_PCT}% or
            more on the previous month is flagged as a price hike; a jump of{" "}
            {SUSPECT_UP_PCT}%+ (or a fall of {Math.abs(SUSPECT_DOWN_PCT)}%+) is
            flagged to check the entry instead.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodNavigator type="month" anchor={anchor} onChange={setAnchor} />
          <SegmentedControl
            options={[
              { label: "3 months", value: "3" },
              { label: "6 months", value: "6" },
              { label: "12 months", value: "12" },
            ]}
            value={monthsShown}
            onChange={setMonthsShown}
          />
        </div>
      </div>

      {!loading && hikes.length > 0 && (
        <Card className="mb-4 border-coral/30 bg-coral/5 p-4">
          <p className="text-sm font-medium text-coral">
            {hikes.length} {hikes.length === 1 ? "item has" : "items have"} gone
            up by {HIKE_PCT}% or more
          </p>
          <p className="mt-1 text-sm text-navy/70">
            {hikes
              .slice(0, 5)
              .map(
                (r) => `${r.item.name.trim()} (+${Math.round(r.changePct!)}%)`,
              )
              .join(", ")}
            {hikes.length > 5 ? `, and ${hikes.length - 5} more` : ""}
          </p>
        </Card>
      )}

      {!loading && suspects.length > 0 && (
        <Card className="mb-4 p-4">
          <p className="text-sm font-medium text-navy">
            {suspects.length}{" "}
            {suspects.length === 1 ? "item needs" : "items need"} a check
          </p>
          <p className="mt-1 text-sm text-navy/60">
            {suspects.map((r) => r.item.name.trim()).join(", ")}: deliveries
            look like they were entered in different units (e.g. grams one time,
            kg or jars the next), so the rate can&apos;t be trusted. Correct the
            deliveries so their quantities use the item&apos;s unit.
          </p>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-sm">
          <Input
            type="search"
            placeholder="Search item, supplier or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <SegmentedControl
          options={[
            { label: "All items", value: "all" },
            { label: "Price changed", value: "changed" },
            { label: "Hikes only", value: "hikes" },
            { label: "Check entry", value: "check" },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">
          No costed deliveries in this range.
        </Card>
      ) : visibleRows.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">
          No items match this filter.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                <th className="sticky left-0 bg-white px-4 py-3">Item</th>
                {monthStarts.map((m) => (
                  <th
                    key={m}
                    className="whitespace-nowrap px-4 py-3 text-right"
                  >
                    {periodLabel("month", m)}
                  </th>
                ))}
                <th className="whitespace-nowrap px-4 py-3 text-right">
                  Change
                </th>
                <th className="whitespace-nowrap px-4 py-3">Last delivery</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const hike = isHike(r);
                const suspect = needsCheck(r);
                return (
                  <tr
                    key={r.item.id}
                    className="border-b border-navy/5 last:border-0"
                  >
                    <td className="sticky left-0 bg-white px-4 py-3">
                      <div className="font-medium text-navy">
                        {r.item.name.trim()}
                      </div>
                      <div className="text-xs text-navy/50">
                        per {r.unit}
                        {r.latestSupplier ? ` · ${r.latestSupplier}` : ""}
                      </div>
                    </td>
                    {r.months.map((m, i) => (
                      <td
                        key={monthStarts[i]}
                        className="whitespace-nowrap px-4 py-3 text-right tabular-nums"
                        title={
                          m
                            ? `${m.deliveries} ${m.deliveries === 1 ? "delivery" : "deliveries"} · ${m.qty} ${r.unit} for ${formatRate(m.costCents / 100)}`
                            : undefined
                        }
                      >
                        {m ? (
                          <>
                            <div className="text-navy">
                              {formatRate(m.rate)}
                            </div>
                            <div className="text-xs text-navy/40">
                              {m.deliveries}{" "}
                              {m.deliveries === 1 ? "delivery" : "deliveries"}
                            </div>
                          </>
                        ) : (
                          <span className="text-navy/20">—</span>
                        )}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                      {r.changePct == null ? (
                        <span className="text-navy/30">—</span>
                      ) : (
                        <span
                          className={clsx(
                            "font-medium",
                            suspect
                              ? "text-navy/50"
                              : r.changePct >= MOVE_PCT
                                ? "text-coral"
                                : r.changePct <= -MOVE_PCT
                                  ? "text-teal"
                                  : "text-navy/50",
                          )}
                        >
                          {r.changePct > 0 ? "+" : ""}
                          {Math.round(r.changePct)}%
                        </span>
                      )}
                      {hike && (
                        <div className="mt-1">
                          <span className="rounded-full bg-coral/10 px-2 py-0.5 text-xs font-medium text-coral">
                            Price hike
                          </span>
                        </div>
                      )}
                      {suspect && (
                        <div className="mt-1">
                          <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy/70">
                            Check entry
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-navy/70">
                      <div className="tabular-nums">
                        {formatRate(
                          r.latest.cost_cents! / 100 / r.latest.quantity,
                        )}
                        /{r.unit}
                      </div>
                      <div className="text-xs text-navy/40">
                        {formatDate(r.latest.purchase_date)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
