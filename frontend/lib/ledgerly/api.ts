// Ledgerly-specific endpoints. Auth (Google Sign-In), token storage, and the
// underlying fetch helper live in lib/admin/api.ts and are shared with the
// rest of /admin. Only GET /api/ledgerly/summary/pnl (and the /access ping)
// are gated by a narrower Ledgerly-only whitelist on the backend — every
// other endpoint here uses the same access as Shiftly/Pantrly.
import { apiRequest, ApiError } from "@/lib/admin/api";

export { ApiError };

function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequest<T>(path, options, "/admin/login");
}

export type Category =
  | "rent"
  | "utilities"
  | "supplier_purchase"
  | "salary"
  | "maintenance"
  | "marketing"
  | "licenses_fees"
  | "transport"
  | "equipment"
  | "other";

export type Payment = {
  id: string;
  category: Category;
  amount_cents: number;
  payment_date: string;
  payment_method: string;
  payee: string;
  employee_id: string | null;
  supplier_id: string | null;
  notes: string;
};

export type DailyLog = {
  id: string;
  log_date: string;
  cash_cents: number;
  card_cents: number;
  upi_cents: number;
  notes: string;
};

export type Sale = {
  id: string;
  sale_date: string;
  amount_cents: number;
  payment_method: string;
  notes: string;
};

export type PnlSummary = {
  range: string;
  from: string;
  to: string;
  revenue_cents: number;
  payments_cents: number;
  purchases_cents: number;
  expenses_cents: number;
  profit_cents: number;
  pantrly_purchases: {
    id: string;
    item_name: string;
    quantity: number;
    cost_cents: number | null;
    purchase_date: string;
    notes: string;
  }[];
};

export const api = {
  // Access probe for the gated P&L summary — 200 if allowed, throws
  // ApiError(403) otherwise.
  checkAccess: () => request<void>("/api/ledgerly/access"),

  logDailyRevenue: (body: {
    date?: string;
    cash_cents: number;
    card_cents: number;
    upi_cents: number;
    notes?: string;
  }) =>
    request<DailyLog>("/api/ledgerly/revenue/log", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listDailyRevenue: (params: { from: string; to: string }) => {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    return request<DailyLog[]>(`/api/ledgerly/revenue?${q.toString()}`);
  },

  logSale: (body: { sale_date?: string; amount_cents: number; payment_method: string; notes?: string }) =>
    request<Sale>("/api/ledgerly/revenue/sales", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listSales: (params: { from: string; to: string }) => {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    return request<Sale[]>(`/api/ledgerly/revenue/sales?${q.toString()}`);
  },

  listPayments: (params: { category?: string; from: string; to: string }) => {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    if (params.category) q.set("category", params.category);
    return request<Payment[]>(`/api/ledgerly/payments/?${q.toString()}`);
  },

  createPayment: (p: Partial<Payment>) =>
    request<Payment>("/api/ledgerly/payments/", {
      method: "POST",
      body: JSON.stringify(p),
    }),

  updatePayment: (id: string, p: Partial<Payment>) =>
    request<Payment>(`/api/ledgerly/payments/${id}`, {
      method: "PUT",
      body: JSON.stringify(p),
    }),

  deletePayment: (id: string) =>
    request<void>(`/api/ledgerly/payments/${id}`, { method: "DELETE" }),

  pnlSummary: (range: "week" | "month", anchorDate: string) =>
    request<PnlSummary>(`/api/ledgerly/summary/pnl?range=${range}&anchor_date=${anchorDate}`),
};
