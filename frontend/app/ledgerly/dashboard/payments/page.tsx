"use client";

import { useEffect, useState } from "react";
import { api as ledgerlyApi, Payment } from "@/lib/ledgerly/api";
import { api as shiftlyApi, Employee } from "@/lib/shiftly/api";
import { api as pantrlyApi, Supplier } from "@/lib/pantrly/api";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Modal } from "@/components/admin/ui/modal";
import { IconButton } from "@/components/admin/ui/icon-button";
import { TrashIcon } from "@/components/admin/ui/icons";
import { PaymentForm, PaymentFormValue } from "@/components/ledgerly/payment-form";
import { formatINR } from "@/lib/admin/format";
import { usePageTitle } from "@/lib/admin/use-page-title";

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

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function PaymentsPage() {
  usePageTitle("Expense");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [paymentsData, employeesData, suppliersData] = await Promise.all([
        ledgerlyApi.listPayments({ from: firstOfMonth(), to: today() }),
        shiftlyApi.listEmployees(),
        pantrlyApi.listSuppliers(),
      ]);
      setPayments(paymentsData ?? []);
      setEmployees(employeesData ?? []);
      setSuppliers(suppliersData ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Expense</h1>
          <p className="mt-1 text-sm text-navy/60">
            Every outgoing expense — restaurant expenses, supplier purchases, salaries, or anything else.
          </p>
        </div>
        <Button onClick={openCreate}>+ Add expense</Button>
      </div>

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : payments.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">No expenses logged this month yet.</Card>
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
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-navy/5 last:border-0">
                  <td className="px-5 py-3 text-navy/70">{p.payment_date}</td>
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
              ))}
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
