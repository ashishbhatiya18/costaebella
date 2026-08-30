// Pantrly-specific endpoints. Auth (Google Sign-In), token storage, and the
// underlying fetch helper live in lib/admin/api.ts and are shared with the
// rest of /admin.
import { apiRequest } from "@/lib/admin/api";

export { ApiError } from "@/lib/admin/api";

function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequest<T>(path, options, "/admin/login");
}

export type Item = {
  id: string;
  name: string;
  unit: string;
  category: string;
  par_level: number;
  active: boolean;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  notes: string;
  active: boolean;
};

export type StockLog = {
  id: string;
  item_id: string;
  log_date: string;
  opening_qty: number | null;
  closing_qty: number | null;
  logged_by: string;
};

export type Purchase = {
  id: string;
  item_id: string;
  supplier_id: string | null;
  quantity: number;
  cost_cents: number | null;
  purchase_date: string;
  notes: string;
};

export type ItemStock = {
  item_id: string;
  item_name: string;
  unit: string;
  par_level: number;
  current_stock: number;
  low_stock: boolean;
  last_log_date: string | null;
  consumed_in_range: number | null;
};

export type StockSummaryResponse = {
  range: string;
  from: string;
  to: string;
  items: ItemStock[];
};

export const api = {
  listItems: () => request<Item[]>("/api/pantrly/items/"),
  createItem: (i: Partial<Item>) =>
    request<Item>("/api/pantrly/items/", {
      method: "POST",
      body: JSON.stringify(i),
    }),
  updateItem: (id: string, i: Partial<Item>) =>
    request<Item>(`/api/pantrly/items/${id}`, {
      method: "PUT",
      body: JSON.stringify(i),
    }),
  deleteItem: (id: string) =>
    request<void>(`/api/pantrly/items/${id}`, { method: "DELETE" }),

  listSuppliers: () => request<Supplier[]>("/api/pantrly/suppliers/"),
  createSupplier: (s: Partial<Supplier>) =>
    request<Supplier>("/api/pantrly/suppliers/", {
      method: "POST",
      body: JSON.stringify(s),
    }),
  updateSupplier: (id: string, s: Partial<Supplier>) =>
    request<Supplier>(`/api/pantrly/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(s),
    }),
  deleteSupplier: (id: string) =>
    request<void>(`/api/pantrly/suppliers/${id}`, { method: "DELETE" }),

  logStock: (body: {
    item_id: string;
    date?: string;
    field: "opening" | "closing";
    quantity: number;
  }) =>
    request<StockLog>("/api/pantrly/stock/log", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listStockLogs: (params: { item_id?: string; from: string; to: string }) => {
    const q = new URLSearchParams();
    if (params.item_id) q.set("item_id", params.item_id);
    q.set("from", params.from);
    q.set("to", params.to);
    return request<StockLog[]>(`/api/pantrly/stock?${q.toString()}`);
  },

  recordPurchase: (body: {
    item_id: string;
    supplier_id?: string | null;
    quantity: number;
    cost_cents?: number | null;
    purchase_date?: string;
    notes?: string;
  }) =>
    request<Purchase>("/api/pantrly/purchases", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listPurchases: (params: { item_id?: string; from: string; to: string }) => {
    const q = new URLSearchParams();
    if (params.item_id) q.set("item_id", params.item_id);
    q.set("from", params.from);
    q.set("to", params.to);
    return request<Purchase[]>(`/api/pantrly/purchases?${q.toString()}`);
  },

  stockSummary: (range: "week" | "month", anchorDate: string) =>
    request<StockSummaryResponse>(
      `/api/pantrly/summary/stock?range=${range}&anchor_date=${anchorDate}`,
    ),
};
