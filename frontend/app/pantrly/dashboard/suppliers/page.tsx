"use client";

import { useEffect, useState } from "react";
import { api, Supplier } from "@/lib/pantrly/api";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Modal } from "@/components/admin/ui/modal";
import { SupplierForm, SupplierFormValue } from "@/components/pantrly/supplier-form";
import { usePageTitle } from "@/lib/admin/use-page-title";

export default function SuppliersPage() {
  usePageTitle("Suppliers");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listSuppliers();
      setSuppliers(data ?? []);
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

  function openEdit(s: Supplier) {
    setEditing(s);
    setModalOpen(true);
  }

  async function handleSubmit(value: SupplierFormValue) {
    if (editing) {
      await api.updateSupplier(editing.id, value);
    } else {
      await api.createSupplier(value);
    }
    setModalOpen(false);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this supplier? This cannot be undone.")) return;
    await api.deleteSupplier(id);
    await load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Suppliers</h1>
          <p className="mt-1 text-sm text-navy/60">
            Offline suppliers — phone/in-person contacts, no ordering integration.
          </p>
        </div>
        <Button onClick={openCreate}>+ Add supplier</Button>
      </div>

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : suppliers.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">
          No suppliers yet. Add your first one to get started.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((s) => (
            <Card key={s.id} className="p-5">
              <h3 className="font-semibold text-navy">{s.name}</h3>
              <p className="mt-1 text-sm text-navy/60">{s.phone || "No phone on file"}</p>
              {s.notes && <p className="mt-2 text-xs text-navy/50">{s.notes}</p>}

              <div className="mt-4 flex gap-2 border-t border-navy/10 pt-4">
                <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(s.id)}>
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
        title={editing ? "Edit supplier" : "Add supplier"}
      >
        <SupplierForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitLabel={editing ? "Save changes" : "Add supplier"}
        />
      </Modal>
    </div>
  );
}
