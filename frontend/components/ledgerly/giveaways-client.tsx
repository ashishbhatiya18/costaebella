"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, Sale } from "@/lib/ledgerly/api";
import { api as shiftlyApi, Employee } from "@/lib/shiftly/api";
import { RecipientType, STAFF_CATEGORIES } from "@/lib/ledgerly/giveaways";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { IconButton } from "@/components/admin/ui/icon-button";
import { PencilIcon } from "@/components/admin/ui/icons";
import { Input, Label } from "@/components/admin/ui/input";
import { Modal } from "@/components/admin/ui/modal";
import { PeriodNavigator } from "@/components/admin/ui/period-navigator";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { clsx } from "@/lib/admin/clsx";
import { formatDate, formatINR } from "@/lib/admin/format";
import { usePageTitle } from "@/lib/admin/use-page-title";
import { monthRange, monthRangeLabel, todayStr } from "@/lib/admin/period";

const NOT_RECORDED = "Not recorded";

// One discount or complimentary bill, with what it cost the business.
type Giveaway = {
  sale: Sale;
  kind: "complimentary" | "discount";
  category: string;
  person: string;
  personKey: string;
  isStaff: boolean;
  dishes: { name: string; quantity: number }[];
  dishCount: number;
  // Complimentary: menu value of its dishes. Discount: the discount.
  givenAwayCents: number;
  // Complimentary: same as givenAwayCents. Discount: bill before discount.
  billCents: number;
  unpriced: boolean;
};

type Totals = { bills: number; compCents: number; discountCents: number; dishes: number };

function emptyTotals(): Totals {
  return { bills: 0, compCents: 0, discountCents: 0, dishes: 0 };
}

function addTo(t: Totals, g: Giveaway) {
  t.bills++;
  t.dishes += g.kind === "complimentary" ? g.dishCount : 0;
  if (g.kind === "complimentary") t.compCents += g.givenAwayCents;
  else t.discountCents += g.givenAwayCents;
}

function groupItemNames(names: string[]) {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts.entries()].map(([name, quantity]) => ({ name, quantity }));
}

function toGiveaway(s: Sale, prices: Record<string, number>): Giveaway {
  const names = s.item_names ?? [];
  const isStaff = !!s.given_to_employee_id;
  const person = s.given_to?.trim() || NOT_RECORDED;
  let givenAwayCents = s.discount_cents;
  let billCents = s.amount_cents + s.discount_cents;
  let unpriced = false;
  if (s.is_complimentary) {
    givenAwayCents = 0;
    for (const name of names) {
      if (prices[name] != null) givenAwayCents += Math.round(prices[name] * 100);
      else unpriced = true;
    }
    billCents = givenAwayCents;
  }
  return {
    sale: s,
    kind: s.is_complimentary ? "complimentary" : "discount",
    category: s.discount_reason || "Uncategorised",
    person,
    // Staff are grouped by employee (survives renames); others by name,
    // ignoring case so "Vardha" and "vardha" count as one person.
    personKey: isStaff ? `staff:${s.given_to_employee_id}` : `other:${person.toLowerCase()}`,
    isStaff,
    dishes: groupItemNames(names),
    dishCount: names.length,
    givenAwayCents,
    billCents,
    unpriced,
  };
}

function StaffBadge() {
  return <span className="ml-1.5 rounded-full bg-teal/10 px-2 py-0.5 text-[11px] font-medium text-teal">Staff</span>;
}

function KindBadge({ kind }: { kind: Giveaway["kind"] }) {
  return kind === "complimentary" ? (
    <span className="rounded-full bg-coral/15 px-2 py-0.5 text-xs font-medium text-coral">Complimentary</span>
  ) : (
    <span className="rounded-full bg-sand/40 px-2 py-0.5 text-xs font-medium text-navy/70">Discount</span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-navy/50">{label}</p>
      <p className="mt-1 text-xl font-semibold text-navy">{value}</p>
      {sub && <p className="text-xs text-navy/50">{sub}</p>}
    </Card>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function GiveawaysClient({ prices }: { prices: Record<string, number> }) {
  usePageTitle("Giveaways");
  const [from, setFrom] = useState(() => monthRange(todayStr()).from);
  const [to, setTo] = useState(() => monthRange(todayStr()).to);
  // Result tagged with the range it answers, so "loading" is derived
  // (result key != current key) rather than set synchronously in the effect.
  const [result, setResult] = useState<{ key: string; sales: Sale[]; error: string | null } | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pastRecipients, setPastRecipients] = useState<string[]>([]);

  const [kindFilter, setKindFilter] = useState<"all" | "complimentary" | "discount">("all");
  const [recipientFilter, setRecipientFilter] = useState<"all" | RecipientType>("all");
  const [personFilter, setPersonFilter] = useState<{ key: string; name: string } | null>(null);

  const [editing, setEditing] = useState<Giveaway | null>(null);

  function goToMonth(anchor: string) {
    const r = monthRange(anchor);
    setFrom(r.from);
    setTo(r.to);
  }

  useEffect(() => {
    shiftlyApi
      .listEmployees()
      .then((data) => setEmployees(data ?? []))
      .catch(() => setEmployees([]));
    api
      .listRecipientNames()
      .then((data) => setPastRecipients(data ?? []))
      .catch(() => setPastRecipients([]));
  }, []);

  const requestKey = `${from}|${to}`;
  useEffect(() => {
    let cancelled = false;
    const key = `${from}|${to}`;
    api
      .listSales({ from, to })
      .then((data) => {
        if (!cancelled) setResult({ key, sales: data ?? [], error: null });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, sales: [], error: "Couldn't load sales for this range." });
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);
  const loading = result?.key !== requestKey;
  const error = loading ? null : result.error;
  const sales = useMemo(() => (loading || !result ? [] : result.sales), [loading, result]);

  const all = useMemo(
    () => sales.filter((s) => s.is_complimentary || s.discount_cents > 0).map((s) => toGiveaway(s, prices)),
    [sales, prices],
  );

  const filtered = useMemo(
    () =>
      all.filter(
        (g) =>
          (kindFilter === "all" || g.kind === kindFilter) &&
          (recipientFilter === "all" || (recipientFilter === "staff") === g.isStaff) &&
          (!personFilter || g.personKey === personFilter.key),
      ),
    [all, kindFilter, recipientFilter, personFilter],
  );

  const summary = useMemo(() => {
    const total = emptyTotals();
    const staff = emptyTotals();
    const others = emptyTotals();
    const byCategory = new Map<string, Totals>();
    const byPerson = new Map<string, Totals & { name: string; isStaff: boolean; last: string }>();
    for (const g of filtered) {
      addTo(total, g);
      addTo(g.isStaff ? staff : others, g);
      const cat = byCategory.get(g.category) ?? emptyTotals();
      addTo(cat, g);
      byCategory.set(g.category, cat);
      const p = byPerson.get(g.personKey) ?? { ...emptyTotals(), name: g.person, isStaff: g.isStaff, last: g.sale.sale_date };
      addTo(p, g);
      if (g.sale.sale_date > p.last) p.last = g.sale.sale_date;
      byPerson.set(g.personKey, p);
    }
    const value = (t: Totals) => t.compCents + t.discountCents;
    return {
      total,
      staff,
      others,
      categories: [...byCategory.entries()].map(([name, t]) => ({ name, ...t })).sort((a, b) => value(b) - value(a)),
      people: [...byPerson.entries()].map(([key, t]) => ({ key, ...t })).sort((a, b) => value(b) - value(a)),
      unpriced: filtered.some((g) => g.unpriced),
      unrecorded: filtered.filter((g) => g.person === NOT_RECORDED).length,
    };
  }, [filtered]);

  function onRecipientSaved(updated: Sale) {
    setResult((prev) => prev && { ...prev, sales: prev.sales.map((s) => (s.id === updated.id ? updated : s)) });
    const name = updated.given_to?.trim();
    if (name && !updated.given_to_employee_id && !pastRecipients.includes(name)) {
      setPastRecipients([name, ...pastRecipients]);
    }
    setEditing(null);
  }

  const totalValue = summary.total.compCents + summary.total.discountCents;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Giveaways</h1>
          <p className="mt-1 text-sm text-navy/60">
            Discounts and complimentary bills — by category and by who they were given to.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodNavigator type="month" anchor={from} onChange={goToMonth} label={monthRangeLabel(from, to)} />
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
            <span className="text-navy/40">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl
          options={[
            { label: "All", value: "all" },
            { label: "Complimentary", value: "complimentary" },
            { label: "Discounts", value: "discount" },
          ]}
          value={kindFilter}
          onChange={setKindFilter}
        />
        <SegmentedControl
          options={[
            { label: "Everyone", value: "all" },
            { label: "Staff", value: "staff" },
            { label: "Others", value: "other" },
          ]}
          value={recipientFilter}
          onChange={setRecipientFilter}
        />
        {personFilter && (
          <button
            type="button"
            onClick={() => setPersonFilter(null)}
            className="flex items-center gap-1.5 rounded-full bg-teal/15 py-1 pl-3 pr-2 text-sm font-medium text-teal"
          >
            {personFilter.name} <span aria-hidden="true">×</span>
            <span className="sr-only">Clear person filter</span>
          </button>
        )}
      </div>

      {error ? (
        <p className="text-sm text-coral">{error}</p>
      ) : loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : all.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">No discounts or complimentary bills in this range.</Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total given away" value={formatINR(totalValue)} sub={plural(summary.total.bills, "bill")} />
            <StatCard
              label="Complimentary"
              value={formatINR(summary.total.compCents)}
              sub={`${plural(summary.total.dishes, "dish")} at menu price${summary.unpriced ? " (some unpriced)" : ""}`}
            />
            <StatCard label="Discounts" value={formatINR(summary.total.discountCents)} sub="taken off bills" />
            <StatCard
              label="Staff · Others"
              value={`${formatINR(summary.staff.compCents + summary.staff.discountCents)} · ${formatINR(summary.others.compCents + summary.others.discountCents)}`}
              sub={`${plural(summary.staff.bills, "bill")} · ${plural(summary.others.bills, "bill")}`}
            />
          </div>

          {summary.unrecorded > 0 && (
            <Card className="mb-4 p-4">
              <p className="text-xs text-navy/60">
                {plural(summary.unrecorded, "bill")} here {summary.unrecorded === 1 ? "has" : "have"} no record of who it
                was given to — use the pencil on that row below to add it.
              </p>
            </Card>
          )}

          <div className="mb-4 grid gap-4 xl:grid-cols-2">
            <Card className="overflow-x-auto">
              <h2 className="px-5 pt-4 font-semibold text-navy">By category</h2>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Bills</th>
                    <th className="px-5 py-3">Complimentary</th>
                    <th className="px-5 py-3">Discounts</th>
                    <th className="px-5 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.categories.map((c) => (
                    <tr key={c.name} className="border-b border-navy/5 last:border-0">
                      <td className="px-5 py-3 font-medium text-navy">{c.name}</td>
                      <td className="px-5 py-3 text-navy/70">{c.bills}</td>
                      <td className="px-5 py-3 text-navy/70">{formatINR(c.compCents)}</td>
                      <td className="px-5 py-3 text-navy/70">{formatINR(c.discountCents)}</td>
                      <td className="px-5 py-3 font-medium text-navy">{formatINR(c.compCents + c.discountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card className="overflow-x-auto">
              <h2 className="px-5 pt-4 font-semibold text-navy">By person</h2>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                    <th className="px-5 py-3">Given to</th>
                    <th className="px-5 py-3">Bills</th>
                    <th className="px-5 py-3">Free dishes</th>
                    <th className="px-5 py-3">Total</th>
                    <th className="px-5 py-3">Last</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.people.map((p) => (
                    <tr
                      key={p.key}
                      onClick={() => setPersonFilter({ key: p.key, name: p.name })}
                      className={clsx(
                        "cursor-pointer border-b border-navy/5 last:border-0 hover:bg-cream/60",
                        personFilter?.key === p.key && "bg-teal/5",
                      )}
                    >
                      <td className="px-5 py-3 font-medium text-navy">
                        <span className={clsx(p.name === NOT_RECORDED && "italic text-navy/50")}>{p.name}</span>
                        {p.isStaff && <StaffBadge />}
                      </td>
                      <td className="px-5 py-3 text-navy/70">{p.bills}</td>
                      <td className="px-5 py-3 text-navy/70">{p.dishes}</td>
                      <td className="px-5 py-3 font-medium text-navy">{formatINR(p.compCents + p.discountCents)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-navy/70">{formatDate(p.last)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          <Card className="overflow-x-auto">
            <h2 className="px-5 pt-4 font-semibold text-navy">All bills</h2>
            {filtered.length === 0 ? (
              <p className="px-5 py-6 text-sm text-navy/50">Nothing matches these filters.</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Given to</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Dishes</th>
                    <th className="px-5 py-3">Bill value</th>
                    <th className="px-5 py-3">Given away</th>
                    <th className="px-5 py-3">Received</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g) => (
                    <tr key={g.sale.id} className="border-b border-navy/5 align-top last:border-0">
                      <td className="whitespace-nowrap px-5 py-3 text-navy/70">{formatDate(g.sale.sale_date)}</td>
                      <td className="px-5 py-3 font-medium text-navy">
                        <span className={clsx(g.person === NOT_RECORDED && "italic text-navy/50")}>{g.person}</span>
                        {g.isStaff && <StaffBadge />}
                      </td>
                      <td className="px-5 py-3 text-navy/70">{g.category}</td>
                      <td className="px-5 py-3">
                        <KindBadge kind={g.kind} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex min-w-48 flex-wrap gap-1">
                          {g.dishes.map(({ name, quantity }) => (
                            <span key={name} className="rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal">
                              {name}
                              {quantity > 1 && ` ×${quantity}`}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-navy/70">
                        {formatINR(g.billCents)}
                        {g.unpriced && <span className="text-navy/40" title="Some dishes have no menu price"> *</span>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-navy">{formatINR(g.givenAwayCents)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-navy/70">{formatINR(g.sale.amount_cents)}</td>
                      <td className="px-3 py-2">
                        <IconButton onClick={() => setEditing(g)} aria-label="Edit who it was given to">
                          <PencilIcon />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <p className="mt-3 text-xs text-navy/50">
            Complimentary bills are valued at menu price (from menu.yaml); discounts at the amount taken off. Neither
            counts as income, and the ingredients used are already in stock and purchases, so this is not added to
            expenses in the P&amp;L. Click a person to see only their bills.
          </p>
        </>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Who was it given to?">
        {editing && (
          <RecipientForm
            key={editing.sale.id}
            giveaway={editing}
            employees={employees}
            pastRecipients={pastRecipients}
            onSaved={onRecipientSaved}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function RecipientForm({
  giveaway,
  employees,
  pastRecipients,
  onSaved,
  onCancel,
}: {
  giveaway: Giveaway;
  employees: Employee[];
  pastRecipients: string[];
  onSaved: (s: Sale) => void;
  onCancel: () => void;
}) {
  const s = giveaway.sale;
  // Unrecorded bills in a staff category start on "Staff".
  const [type, setType] = useState<RecipientType>(
    s.given_to_employee_id || (!s.given_to && STAFF_CATEGORIES.includes(s.discount_reason)) ? "staff" : "other",
  );
  const [employeeId, setEmployeeId] = useState(s.given_to_employee_id ?? "");
  const [name, setName] = useState(s.given_to_employee_id ? "" : s.given_to ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active staff first; an inactive one stays listed if already linked.
  const options = employees.filter((e) => e.active || e.id === s.given_to_employee_id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (type === "staff" ? !employeeId : !name.trim()) {
      setError(type === "staff" ? "Choose a staff member." : "Enter a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateSaleRecipient(
        s.id,
        type === "staff" ? { given_to_employee_id: employeeId } : { given_to: name.trim(), given_to_employee_id: null },
      );
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-navy/60">
        {formatDate(s.sale_date)} · {giveaway.category} · {giveaway.dishes.map((d) => d.name).join(", ")}
      </p>
      {s.notes && <p className="rounded-xl bg-cream/60 px-3 py-2 text-xs text-navy/60">Notes: {s.notes}</p>}
      <div className="inline-flex rounded-lg border border-navy/10 bg-cream/60 p-0.5 text-sm">
        {(["staff", "other"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={clsx(
              "rounded-md px-3 py-1 font-medium transition-colors",
              type === t ? "bg-teal text-white shadow-sm" : "text-navy/60 hover:text-navy",
            )}
          >
            {t === "staff" ? "Staff" : "Other"}
          </button>
        ))}
      </div>
      {type === "staff" ? (
        <div>
          <Label htmlFor="recipient-employee">Staff member</Label>
          <select
            id="recipient-employee"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full rounded-xl border border-navy/15 bg-cream/40 px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20"
          >
            <option value="">Select a staff member…</option>
            {options.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {!e.active && " (inactive)"}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <Label htmlFor="recipient-name">Name</Label>
          <Input
            id="recipient-name"
            list="recipient-names"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name of the person or group"
          />
          <datalist id="recipient-names">
            {pastRecipients.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
      )}
      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          Save
        </Button>
      </div>
    </form>
  );
}
