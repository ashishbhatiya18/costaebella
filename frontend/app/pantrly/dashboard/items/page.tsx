"use client";

import { useEffect, useMemo, useState } from "react";
import { api, Item, ItemStock, StockLog, Supplier } from "@/lib/pantrly/api";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Modal } from "@/components/admin/ui/modal";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { SplitButton } from "@/components/admin/ui/split-button";
import { IconButton } from "@/components/admin/ui/icon-button";
import { PencilIcon, TrashIcon } from "@/components/admin/ui/icons";
import { ItemForm, ItemFormValue } from "@/components/pantrly/item-form";
import { RecordDeliveryForm, DeliveryFormValue } from "@/components/pantrly/record-delivery-form";
import { LogStockForm } from "@/components/pantrly/log-stock-form";
import { DeliveriesModal } from "@/components/pantrly/deliveries-modal";
import { StockLogsModal } from "@/components/pantrly/stock-logs-modal";
import { StockLogsTable } from "@/components/pantrly/stock-logs-table";
import { WastageForm, WastageFormValue } from "@/components/pantrly/wastage-form";
import { WastageModal } from "@/components/pantrly/wastage-modal";
import { AddItemSupplierForm } from "@/components/pantrly/add-item-supplier-form";
import { ItemSuppliersModal } from "@/components/pantrly/item-suppliers-modal";
import { PriceTrendModal } from "@/components/pantrly/price-trend-modal";
import { MenuImpactModal } from "@/components/pantrly/menu-impact-modal";
import { StockSummaryList } from "@/components/pantrly/stock-summary-list";
import { usePageTitle } from "@/lib/admin/use-page-title";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Days since a YYYY-MM-DD date, or null if never counted.
function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr + "T00:00:00").getTime();
  const now = new Date(today() + "T00:00:00").getTime();
  return Math.round((now - then) / (1000 * 60 * 60 * 24));
}

function staleness(days: number | null): "fresh" | "due" | "overdue" {
  if (days == null || days >= 14) return "overdue";
  if (days >= 7) return "due";
  return "fresh";
}

function countLabel(days: number | null) {
  if (days == null) return "Never counted";
  if (days === 0) return "Counted today";
  if (days === 1) return "Counted yesterday";
  return `Counted ${days} days ago`;
}

const STALENESS_CLASSES: Record<string, string> = {
  fresh: "text-teal",
  due: "text-amber-600",
  overdue: "text-coral",
};

export default function ItemsPage() {
  usePageTitle("Items");
  const [items, setItems] = useState<Item[]>([]);
  const [stockByItem, setStockByItem] = useState<Map<string, ItemStock>>(new Map());
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [deliveryFor, setDeliveryFor] = useState<Item | null>(null);
  const [logStockFor, setLogStockFor] = useState<Item | null>(null);
  const [recentStockLogs, setRecentStockLogs] = useState<StockLog[]>([]);
  const [stockLogsFor, setStockLogsFor] = useState<Item | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<Item | null>(null);
  const [wastageFor, setWastageFor] = useState<Item | null>(null);
  const [wastageHistoryFor, setWastageHistoryFor] = useState<Item | null>(null);
  const [addSupplierFor, setAddSupplierFor] = useState<Item | null>(null);
  const [addSupplierLinkedIds, setAddSupplierLinkedIds] = useState<string[]>([]);
  const [suppliersHistoryFor, setSuppliersHistoryFor] = useState<Item | null>(null);
  const [priceTrendFor, setPriceTrendFor] = useState<Item | null>(null);
  const [menuImpactFor, setMenuImpactFor] = useState<Item | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  const filteredItems = items.filter((it) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      it.name.toLowerCase().includes(q) ||
      (it.category ?? "").toLowerCase().includes(q)
    );
  });

  // Card view groups by category (lexicographic), then sorts items within
  // each group lexicographically by name.
  const groupedItems = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const it of filteredItems) {
      const category = it.category || "Uncategorized";
      const bucket = groups.get(category);
      if (bucket) bucket.push(it);
      else groups.set(category, [it]);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, its]) => ({
        category,
        items: [...its].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [filteredItems]);

  async function load() {
    setLoading(true);
    try {
      const [itemsData, suppliersData, stockData] = await Promise.all([
        api.listItems(),
        api.listSuppliers(),
        api.stockSummary("week", today()),
      ]);
      setItems(itemsData ?? []);
      setSuppliers(suppliersData ?? []);
      setStockByItem(new Map((stockData.items ?? []).map((s) => [s.item_id, s])));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!logStockFor) {
      setRecentStockLogs([]);
      return;
    }
    api
      .listStockLogs({ item_id: logStockFor.id, from: daysAgo(90), to: daysAgo(0) })
      .then((data) => setRecentStockLogs((data ?? []).slice().reverse()));
  }, [logStockFor]);

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
    // A delivery from a supplier implies that supplier can provide this
    // item — link them so it shows up under the item's Suppliers list
    // without a separate manual step.
    if (value.supplier_id) {
      await api.addItemSupplier(deliveryFor.id, value.supplier_id);
    }
    setDeliveryFor(null);
    await load();
  }

  async function handleLogStock(quantity: number, date: string) {
    if (!logStockFor) return;
    await api.logStock({ item_id: logStockFor.id, date, field: "closing", quantity });
    setLogStockFor(null);
    await load();
  }

  async function handleWastage(value: WastageFormValue) {
    if (!wastageFor) return;
    await api.logWastage({ item_id: wastageFor.id, ...value });
    setWastageFor(null);
    await load();
  }

  async function openAddSupplier(it: Item) {
    setAddSupplierFor(it);
    const linked = await api.listItemSuppliers(it.id);
    setAddSupplierLinkedIds((linked ?? []).map((s) => s.supplier_id));
  }

  async function handleAddSupplier(supplierId: string) {
    if (!addSupplierFor) return;
    await api.addItemSupplier(addSupplierFor.id, supplierId);
    setAddSupplierFor(null);
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
        <div className="flex items-center gap-3">
          <SegmentedControl
            options={[
              { label: "Card view", value: "card" },
              { label: "List view", value: "list" },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
          <Button onClick={openCreate}>+ Add item</Button>
        </div>
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

      {viewMode === "list" ? (
        <StockSummaryList
          search={search}
          items={items}
          onEdit={openEdit}
          onDelete={handleDelete}
          onLogStock={setLogStockFor}
          onStockLogs={setStockLogsFor}
          onDelivery={setDeliveryFor}
          onDeliveries={setDeliveriesFor}
          onWastage={setWastageFor}
          onWastageHistory={setWastageHistoryFor}
          onAddSupplier={openAddSupplier}
          onSuppliersHistory={setSuppliersHistoryFor}
          onPriceTrend={setPriceTrendFor}
          onMenuImpact={setMenuImpactFor}
        />
      ) : (
        <>
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
            <div className="space-y-8">
              {groupedItems.map(({ category, items: categoryItems }) => (
                <div key={category}>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy/50">
                    {category}
                  </h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {categoryItems.map((it) => {
                      const stock = stockByItem.get(it.id) ?? null;
                      const days = daysSince(stock?.last_log_date ?? null);
                      const level = staleness(days);
                      return (
                        <Card key={it.id} className="p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-navy">{it.name}</h3>
                              <p className="text-sm text-navy/60">{it.category || "Uncategorized"}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <span className="rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal">
                                {it.unit}
                              </span>
                              <div className="flex items-center gap-1">
                                <IconButton onClick={() => openEdit(it)} aria-label="Edit item">
                                  <PencilIcon />
                                </IconButton>
                                <IconButton
                                  variant="danger"
                                  onClick={() => handleDelete(it.id)}
                                  aria-label="Delete item"
                                >
                                  <TrashIcon />
                                </IconButton>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 text-xs text-navy/50">
                            Current quantity: {stock?.current_stock ?? "—"} {it.unit}
                          </div>
                          <div className="mt-1 text-xs text-navy/50">
                            Order below quantity: {it.par_level} {it.unit}
                          </div>
                          <div className={"mt-1 text-xs font-medium " + STALENESS_CLASSES[level]}>
                            {countLabel(days)}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 border-t border-navy/10 pt-4">
                            <SplitButton
                              label="Add Stock Count"
                              onClick={() => setLogStockFor(it)}
                              options={[{ label: "View Stock Counts", onClick: () => setStockLogsFor(it) }]}
                            />
                            <Button size="sm" variant="secondary" onClick={() => setMenuImpactFor(it)}>
                              Menu impact
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setPriceTrendFor(it)}>
                              Price trend
                            </Button>
                            <SplitButton
                              label="Add delivery"
                              onClick={() => setDeliveryFor(it)}
                              options={[{ label: "Deliveries", onClick: () => setDeliveriesFor(it) }]}
                            />
                            <SplitButton
                              label="Add wastage"
                              onClick={() => setWastageFor(it)}
                              options={[{ label: "Wastage", onClick: () => setWastageHistoryFor(it) }]}
                            />
                            <SplitButton
                              label="Suppliers"
                              onClick={() => setSuppliersHistoryFor(it)}
                              options={[{ label: "Add supplier", onClick: () => openAddSupplier(it) }]}
                            />
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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
          unit={deliveryFor?.unit ?? ""}
          onSubmit={handleDelivery}
          onCancel={() => setDeliveryFor(null)}
        />
      </Modal>

      <Modal
        open={logStockFor !== null}
        onClose={() => setLogStockFor(null)}
        title={logStockFor ? `Add stock count — ${logStockFor.name}` : "Add stock count"}
      >
        {logStockFor && (
          <div className="space-y-5">
            <LogStockForm
              unit={logStockFor.unit}
              currentEstimate={stockByItem.get(logStockFor.id)?.current_stock ?? null}
              onSubmit={handleLogStock}
              onCancel={() => setLogStockFor(null)}
            />
            <div className="border-t border-navy/10 pt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy/50">
                Past stock counts
              </h4>
              <StockLogsTable logs={recentStockLogs} unit={logStockFor.unit} />
            </div>
          </div>
        )}
      </Modal>

      <StockLogsModal
        itemId={stockLogsFor?.id ?? null}
        itemName={stockLogsFor?.name ?? ""}
        unit={stockLogsFor?.unit ?? ""}
        onClose={() => setStockLogsFor(null)}
      />

      <DeliveriesModal
        itemId={deliveriesFor?.id ?? null}
        itemName={deliveriesFor?.name ?? ""}
        unit={deliveriesFor?.unit ?? ""}
        onClose={() => setDeliveriesFor(null)}
      />

      <Modal
        open={wastageFor !== null}
        onClose={() => setWastageFor(null)}
        title={wastageFor ? `Log wastage — ${wastageFor.name}` : "Log wastage"}
      >
        {wastageFor && (
          <WastageForm unit={wastageFor.unit} onSubmit={handleWastage} onCancel={() => setWastageFor(null)} />
        )}
      </Modal>

      <WastageModal
        itemId={wastageHistoryFor?.id ?? null}
        itemName={wastageHistoryFor?.name ?? ""}
        unit={wastageHistoryFor?.unit ?? ""}
        onClose={() => setWastageHistoryFor(null)}
      />

      <Modal
        open={addSupplierFor !== null}
        onClose={() => setAddSupplierFor(null)}
        title={addSupplierFor ? `Add supplier — ${addSupplierFor.name}` : "Add supplier"}
      >
        <AddItemSupplierForm
          suppliers={suppliers}
          linkedSupplierIds={addSupplierLinkedIds}
          onSubmit={handleAddSupplier}
          onCancel={() => setAddSupplierFor(null)}
        />
      </Modal>

      <ItemSuppliersModal
        itemId={suppliersHistoryFor?.id ?? null}
        itemName={suppliersHistoryFor?.name ?? ""}
        onClose={() => setSuppliersHistoryFor(null)}
      />

      <PriceTrendModal
        itemId={priceTrendFor?.id ?? null}
        itemName={priceTrendFor?.name ?? ""}
        unit={priceTrendFor?.unit ?? ""}
        onClose={() => setPriceTrendFor(null)}
      />

      <MenuImpactModal
        itemId={menuImpactFor?.id ?? null}
        itemName={menuImpactFor?.name ?? ""}
        unit={menuImpactFor?.unit ?? ""}
        onClose={() => setMenuImpactFor(null)}
      />
    </div>
  );
}
