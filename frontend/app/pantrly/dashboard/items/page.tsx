"use client";

import { useEffect, useState } from "react";
import { api, Item, Supplier } from "@/lib/pantrly/api";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Modal } from "@/components/admin/ui/modal";
import { ItemForm, ItemFormValue } from "@/components/pantrly/item-form";
import { RecordDeliveryForm, DeliveryFormValue } from "@/components/pantrly/record-delivery-form";
import { usePageTitle } from "@/lib/admin/use-page-title";

export default function ItemsPage() {
  usePageTitle("Items");
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [deliveryFor, setDeliveryFor] = useState<Item | null>(null);
  const [search, setSearch] = useState("");

  const filteredItems = items.filter((it) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      it.name.toLowerCase().includes(q) ||
      (it.category ?? "").toLowerCase().includes(q)
    );
  });

  async function load() {
    setLoading(true);
    try {
      const [itemsData, suppliersData] = await Promise.all([
        api.listItems(),
        api.listSuppliers(),
      ]);
      setItems(itemsData ?? []);
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

  function openEdit(it: Item) {
    setEditing(it);
    setModalOpen(true);
  }

  async function handleSubmit(value: ItemFormValue) {
    if (editing) {
      await api.updateItem(editing.id, value);
    } else {
      await api.createItem(value);
    }
    setModalOpen(false);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    await api.deleteItem(id);
    await load();
  }

  async function handleDelivery(value: DeliveryFormValue) {
    if (!deliveryFor) return;
    await api.recordPurchase({ item_id: deliveryFor.id, ...value });
    setDeliveryFor(null);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Items</h1>
          <p className="mt-1 text-sm text-navy/60">
            Tracked ingredients/products, units, and low-stock thresholds.
          </p>
        </div>
        <Button onClick={openCreate}>+ Add item</Button>
      </div>

      {!loading && items.length > 0 && (
        <div className="mb-4 max-w-sm">
          <Input
            type="search"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">
          No items yet. Add your first one to get started.
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">
          No items match &ldquo;{search}&rdquo;.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((it) => (
            <Card key={it.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-navy">{it.name}</h3>
                  <p className="text-sm text-navy/60">{it.category || "Uncategorized"}</p>
                </div>
                <span className="rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal">
                  {it.unit}
                </span>
              </div>

              <div className="mt-3 text-xs text-navy/50">
                Par level: {it.par_level} {it.unit}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-navy/10 pt-4">
                <Button size="sm" variant="secondary" onClick={() => openEdit(it)}>
                  Edit
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDeliveryFor(it)}>
                  Record delivery
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(it.id)}>
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
        title={editing ? "Edit item" : "Add item"}
      >
        <ItemForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitLabel={editing ? "Save changes" : "Add item"}
        />
      </Modal>

      <Modal
        open={deliveryFor !== null}
        onClose={() => setDeliveryFor(null)}
        title={deliveryFor ? `Record delivery — ${deliveryFor.name}` : "Record delivery"}
      >
        <RecordDeliveryForm
          suppliers={suppliers}
          onSubmit={handleDelivery}
          onCancel={() => setDeliveryFor(null)}
        />
      </Modal>
    </div>
  );
}
