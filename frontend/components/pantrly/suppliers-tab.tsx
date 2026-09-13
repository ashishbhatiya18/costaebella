"use client";

import { useEffect, useMemo, useState } from "react";
import { api, Item, Purchase, Supplier } from "@/lib/pantrly/api";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Modal } from "@/components/admin/ui/modal";
import { IconButton } from "@/components/admin/ui/icon-button";
import { TrashIcon } from "@/components/admin/ui/icons";
import { SupplierForm, SupplierFormValue } from "@/components/pantrly/supplier-form";
import { SupplierDeliveriesModal } from "@/components/pantrly/supplier-deliveries-modal";
import { SupplierRecommendationsModal } from "@/components/pantrly/supplier-recommendations-modal";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function SuppliersTab({
  suppliers,
  loading,
  onChange,
}: {
  suppliers: Supplier[];
  loading: boolean;
  onChange: () => Promise<void>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<Supplier | null>(null);
  const [recommendFor, setRecommendFor] = useState<Supplier | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  async function loadDeliveryData() {
    const [purchasesData, itemsData] = await Promise.all([
      api.listPurchases({ from: daysAgo(90), to: daysAgo(0) }),
      api.listItems(),
    ]);
    setPurchases(purchasesData ?? []);
    setItems(itemsData ?? []);
  }

  useEffect(() => {
    loadDeliveryData();
  }, []);

  const deliveryCountBySupplier = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of purchases) {
      if (!p.supplier_id) continue;
      counts.set(p.supplier_id, (counts.get(p.supplier_id) ?? 0) + 1);
    }
    return counts;
  }, [purchases]);

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
    await onChange();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this supplier? This cannot be undone.")) return;
    await api.deleteSupplier(id);
    await onChange();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-navy/60">
          Offline suppliers — phone/in-person contacts, no ordering integration.
        </p>
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
              <p className="mt-3 text-xs text-navy/50">
                {deliveryCountBySupplier.get(s.id) ?? 0} deliveries (last 90 days)
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-navy/10 pt-4">
                <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>
                  Edit
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDeliveriesFor(s)}>
                  Deliveries
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setRecommendFor(s)}>
                  Recommended order
                </Button>
                <IconButton variant="danger" onClick={() => handleDelete(s.id)} aria-label="Delete supplier">
                  <TrashIcon />
                </IconButton>
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

      <SupplierDeliveriesModal
        supplierId={deliveriesFor?.id ?? null}
        supplierName={deliveriesFor?.name ?? ""}
        items={items}
        onClose={() => setDeliveriesFor(null)}
        onChange={loadDeliveryData}
      />

      <SupplierRecommendationsModal
        supplierId={recommendFor?.id ?? null}
        supplierName={recommendFor?.name ?? ""}
        onClose={() => setRecommendFor(null)}
      />
    </div>
  );
}
