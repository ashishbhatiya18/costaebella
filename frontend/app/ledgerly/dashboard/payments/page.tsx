"use client";

import { useEffect, useState } from "react";
import { api as ledgerlyApi, DeliveryExpense, Payment } from "@/lib/ledgerly/api";
import { api as shiftlyApi, Employee } from "@/lib/shiftly/api";
import { api as pantrlyApi, Supplier } from "@/lib/pantrly/api";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Modal } from "@/components/admin/ui/modal";
import { IconButton } from "@/components/admin/ui/icon-button";
import { TrashIcon } from "@/components/admin/ui/icons";
import { PaymentForm, PaymentFormValue } from "@/components/ledgerly/payment-form";
import { formatDate, formatINR } from "@/lib/admin/format";
import { PeriodNavigator } from "@/components/admin/ui/period-navigator";
import { usePageTitle } from "@/lib/admin/use-page-title";
import { periodBounds, periodLabel, todayStr } from "@/lib/admin/period";

const CATEGORY_LABELS: Record<string, string> = {
  rent: "Rent",
  utilities: "Utilities",
  supplier_purchase: "Supplier purchase",
  salary: "Salary",
  maintenance: "Maintenance",
  marketing: "Marketing",
  licenses_fees: "Licenses & fees",
  transport: "Transport",
  equipment: "Equipment",
  other: "Other",
};

// One row of the Expenses table: either an editable Ledgerly payment or a
// read-only costed Pantrly delivery (which P&L already counts as an expense).
type ExpenseRow =
  | { kind: "payment"; date: string; payment: Payment }
  | { kind: "delivery"; date: string; delivery: DeliveryExpense };

export default function PaymentsPage() {
  usePageTitle("Expense");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryExpense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  // Any date in the month being viewed.
  const [anchor, setAnchor] = useState(todayStr());
  const { from, to } = periodBounds("month", anchor);

  async function load() {
    setLoading(true);
    try {
      const [paymentsData, deliveriesData, employeesData, suppliersData] = await Promise.all([
        ledgerlyApi.listPayments({ from, to }),
        ledgerlyApi.listDeliveryExpenses({ from, to }),
        shiftlyApi.listEmployees(),
        pantrlyApi.listSuppliers(),
      ]);
      setPayments(paymentsData ?? []);
      setDeliveries(deliveriesData ?? []);
      setEmployees(employeesData ?? []);
      setSuppliers(suppliersData ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: Payment) {
    setEditing(p);
    setModalOpen(true);
  }

  async function handleSubmit(value: PaymentFormValue) {
    if (editing) {
      await ledgerlyApi.updatePayment(editing.id, value);
    } else {
      await ledgerlyApi.createPayment(value);
    }
    setModalOpen(false);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense? This cannot be undone.")) return;
    await ledgerlyApi.deletePayment(id);
    await load();
  }

  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name;

  const rows: ExpenseRow[] = [
    ...payments.map((p): ExpenseRow => ({ kind: "payment", date: p.payment_date, payment: p })),
    ...deliveries.map((d): ExpenseRow => ({ kind: "delivery", date: d.purchase_date, delivery: d })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Expense</h1>
          <p className="mt-1 text-sm text-navy/60">
            Every outgoing expense — restaurant expenses, supplier purchases, salaries, or anything else. Costed
            Pantrly deliveries are listed here automatically — don&apos;t log them again as a supplier purchase.
          </p>
        </div>
        <Button onClick={openCreate}>+ Add expense</Button>
      </div>

      <div className="mb-6">
        <PeriodNavigator type="month" anchor={anchor} onChange={setAnchor} />
      </div>

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">No expenses logged in {periodLabel("month", anchor)}.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Payee</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                if (row.kind === "delivery") {
                  const d = row.delivery;
                  return (
                    <tr key={`delivery-${d.id}`} className="border-b border-navy/5 last:border-0">
                      <td className="px-5 py-3 text-navy/70">{formatDate(d.purchase_date)}</td>
                      <td className="px-5 py-3 text-navy/70">Pantrly delivery</td>
                      <td className="px-5 py-3 text-navy">
                        {supplierName(d.supplier_id) ?? "—"}
                        <span className="block text-xs text-navy/50">
                          {d.item_name} × {d.quantity}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium text-navy">{formatINR(d.cost_cents ?? 0)}</td>
                      <td className="px-5 py-3 text-navy/50">{d.payment_method || "—"}</td>
                      <td className="px-5 py-3 text-right text-xs text-navy/50">Managed in Pantrly</td>
                    </tr>
                  );
                }
                const p = row.payment;
                return (
                  <tr key={p.id} className="border-b border-navy/5 last:border-0">
                    <td className="px-5 py-3 text-navy/70">{formatDate(p.payment_date)}</td>
                    <td className="px-5 py-3 text-navy/70">{CATEGORY_LABELS[p.category] ?? p.category}</td>
                    <td className="px-5 py-3 text-navy">{p.payee || "—"}</td>
                    <td className="px-5 py-3 font-medium text-navy">{formatINR(p.amount_cents)}</td>
                    <td className="px-5 py-3 text-navy/50">{p.payment_method || "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>
                          Edit
                        </Button>
                        <IconButton variant="danger" onClick={() => handleDelete(p.id)} aria-label="Delete expense">
                          <TrashIcon />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit expense" : "Add expense"}
      >
        <PaymentForm
          initial={editing ?? undefined}
          employees={employees}
          suppliers={suppliers}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitLabel={editing ? "Save changes" : "Add expense"}
        />
      </Modal>
    </div>
  );
}
