"use client";

import { useEffect, useState } from "react";
import { api, Employee } from "@/lib/shiftly/api";
import { Button } from "@/components/shiftly/ui/button";
import { Card } from "@/components/shiftly/ui/card";
import { Modal } from "@/components/shiftly/ui/modal";
import { EmployeeForm, EmployeeFormValue } from "@/components/shiftly/employee-form";
import { usePageTitle } from "@/lib/admin/use-page-title";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export default function EmployeesPage() {
  usePageTitle("Manage Employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listEmployees();
      setEmployees(data ?? []);
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

  function openEdit(e: Employee) {
    setEditing(e);
    setModalOpen(true);
  }

  async function handleSubmit(value: EmployeeFormValue) {
    if (editing) {
      await api.updateEmployee(editing.id, value);
    } else {
      await api.createEmployee(value);
    }
    setModalOpen(false);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this employee? This cannot be undone.")) return;
    await api.deleteEmployee(id);
    await load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Manage Employees</h1>
          <p className="mt-1 text-sm text-navy/60">
            Employee profiles, shifts, and pay.
          </p>
        </div>
        <Button onClick={openCreate}>+ Add employee</Button>
      </div>

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : employees.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">
          No employees yet. Add your first one to get started.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {employees.map((e) => (
            <Card key={e.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-navy">{e.name}</h3>
                  <p className="text-sm text-navy/60">{e.shift_name || "No shift name"}</p>
                </div>
                <span className="rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal">
                  {formatMoney(e.monthly_pay_cents)}/mo
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {DAY_LABELS.map((label, idx) => (
                  <span
                    key={label}
                    className={
                      "rounded-md px-2 py-0.5 text-xs font-medium " +
                      (e.committed_working_days.includes(idx)
                        ? "bg-teal/15 text-teal"
                        : "bg-navy/5 text-navy/30")
                    }
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div className="mt-3 space-y-1 text-xs text-navy/50">
                {e.shift_intervals.map((iv, i) => (
                  <div key={i}>
                    {iv.day_of_week === null
                      ? "Every day"
                      : DAY_LABELS[iv.day_of_week]}
                    : {iv.start_time}–{iv.end_time}
                  </div>
                ))}
                <div>{e.permitted_leaves_per_month} leaves/month permitted</div>
                <div>Start date: {e.start_date}</div>
              </div>

              <div className="mt-4 flex gap-2 border-t border-navy/10 pt-4">
                <Button size="sm" variant="secondary" onClick={() => openEdit(e)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(e.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit employee" : "Add employee"}
      >
        <EmployeeForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitLabel={editing ? "Save changes" : "Add employee"}
        />
      </Modal>
    </div>
  );
}
