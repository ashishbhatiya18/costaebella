"use client";

import { useEffect, useState } from "react";
import { api, Advance, Employee } from "@/lib/shiftly/api";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Modal } from "@/components/admin/ui/modal";
import { AdvanceForm, AdvanceFormValue } from "@/components/shiftly/advance-form";
import { formatINR } from "@/lib/admin/format";
import { usePageTitle } from "@/lib/admin/use-page-title";

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdvancesPage() {
  usePageTitle("Advances");
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Advance | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [advancesData, employeesData] = await Promise.all([
        api.listAdvances({ from: firstOfMonth(), to: today() }),
        api.listEmployees(),
      ]);
      setAdvances(advancesData ?? []);
      setEmployees(employeesData ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function employeeName(id: string) {
    return employees.find((e) => e.id === id)?.name ?? "—";
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(a: Advance) {
    setEditing(a);
    setModalOpen(true);
  }

  async function handleSubmit(value: AdvanceFormValue) {
    if (editing) {
      await api.updateAdvance(editing.id, value);
    } else {
      await api.createAdvance(value);
    }
    setModalOpen(false);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this advance? This cannot be undone.")) return;
    await api.deleteAdvance(id);
    await load();
  }

  const total = advances.reduce((sum, a) => sum + a.amount_cents, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Advances</h1>
          <p className="mt-1 text-sm text-navy/60">
            Salary advances given to staff — netted against their next payout and counted in Ledgerly.
          </p>
        </div>
        <Button onClick={openCreate}>+ Log advance</Button>
      </div>

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : (
        <>
          <Card className="mb-4 flex items-center justify-between p-5">
            <span className="text-sm text-navy/60">Total advances this month</span>
            <span className="text-2xl font-semibold text-navy">{formatINR(total)}</span>
          </Card>

          {advances.length === 0 ? (
            <Card className="p-10 text-center text-navy/50">No advances logged this month yet.</Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide text-navy/50">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Notes</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {advances.map((a) => (
                    <tr key={a.id} className="border-b border-navy/5 last:border-0">
                      <td className="px-5 py-3 text-navy/70">{a.advance_date}</td>
                      <td className="px-5 py-3 text-navy">{employeeName(a.employee_id)}</td>
                      <td className="px-5 py-3 font-medium text-navy">{formatINR(a.amount_cents)}</td>
                      <td className="px-5 py-3 text-navy/50">{a.notes || "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openEdit(a)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleDelete(a.id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit advance" : "Log advance"}
      >
        <AdvanceForm
          initial={editing ?? undefined}
          employees={employees}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitLabel={editing ? "Save changes" : "Log advance"}
        />
      </Modal>
    </div>
  );
}
