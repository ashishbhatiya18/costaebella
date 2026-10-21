// Ledgerly-specific endpoints. Auth (Google Sign-In), token storage, and the
// underlying fetch helper live in lib/admin/api.ts and are shared with the
// rest of /admin. Only GET /api/ledgerly/summary/pnl (and the /access ping)
// are gated by a narrower Ledgerly-only whitelist on the backend — every
// other endpoint here uses the same access as Shiftly/Pantrly.
import { apiRequest, ApiError } from "@/lib/admin/api";

export { ApiError };

function request<T>(
  path: string,
  options: RequestInit = {},
  redirectOnForbidden: boolean = true,
): Promise<T> {
  return apiRequest<T>(path, options, "/admin/login", redirectOnForbidden);
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

export type Sale = {
  id: string;
  sale_date: string;
  // What was actually received, after any discount. The original bill
  // total is amount_cents + discount_cents.
  amount_cents: number;
  payment_method: string;
  notes: string;
  item_names: string[];
  discount_cents: number;
  // Why the discount or complimentary was given.
  discount_reason: string;
  // Free bill: amount is 0, but its dishes still count toward stock use.
  is_complimentary: boolean;
  // Who a discount / complimentary was given to. For staff,
  // given_to_employee_id links the Shiftly employee and given_to is their
  // name; for anyone else given_to is the typed name and the id is null.
  given_to: string;
  given_to_employee_id: string | null;
};

// A costed Pantrly delivery (GET /api/ledgerly/purchases). Read-only on the
// Ledgerly side — recorded and deleted from Pantrly's Items/Deliveries pages.
export type DeliveryExpense = {
  id: string;
  item_id: string;
  item_name: string;
  supplier_id: string | null;
  quantity: number;
  cost_cents: number | null;
  payment_method: string;
  purchase_date: string;
  notes: string;
};

export type PnlSummary = {
  range: string;
  from: string;
  to: string;
  revenue_cents: number;
  revenue_cash_cents: number;
  revenue_card_cents: number;
  revenue_upi_cents: number;
  revenue_other_cents: number;
  // Every ledgerly_payment; other_payments_cents is the non-salary part,
  // which is what counts toward expenses_cents.
  payments_cents: number;
  other_payments_cents: number;
  purchases_cents: number;
  // Salary earned from attendance — the only staff cost in expenses_cents.
  salary_cents: number;
  // Paid out against earned salary (salary payments + Shiftly advances);
  // shown for reference, not added to expenses_cents.
  salary_payments_cents: number;
  advances_cents: number;
  expenses_cents: number;
  profit_cents: number;
  // Every payment category with a total in range, salary included.
  payments_by_category: Partial<Record<Category, number>> | null;
  pantrly_purchases: {
    id: string;
    item_name: string;
    quantity: number;
    cost_cents: number | null;
    purchase_date: string;
    notes: string;
  }[];
};

export type PnlTrendPoint = {
  from: string;
  to: string;
  revenue_cents: number;
  expenses_cents: number;
  profit_cents: number;
};

// One calendar month of GET /api/ledgerly/summary/expenses/trend. Built from
// the same backend computation as the P&L Summary, so expenses_cents matches
// P&L's figure for that month.
export type ExpenseTrendMonth = {
  from: string;
  to: string;
  revenue_cents: number;
  // Pantrly costed deliveries + supplier_purchase payments (both counted).
  grocery_cents: number;
  grocery_pantrly_cents: number;
  grocery_supplier_payments_cents: number;
  // Salary actually paid in the month: salary_payments_cents + advances_cents.
  salary_cents: number;
  // ledgerly_payments with category = salary.
  salary_payments_cents: number;
  // Shiftly advances given in the month.
  advances_cents: number;
  payments_by_category: Partial<Record<Category, number>> | null;
  payments_cents: number;
  expenses_cents: number;
  profit_cents: number;
};

export type ExpenseTrend = {
  anchor_date: string;
  periods: number;
  months: ExpenseTrendMonth[];
};

export const api = {
  // Access probe for the gated P&L summary — 200 if allowed, throws
  // ApiError(403) otherwise.
  // A 403 here is an expected "not this role" outcome (used to hide the
  // P&L Summary tab for non-owners), not a session problem — don't let it
  // redirect.
  checkAccess: () => request<void>("/api/ledgerly/access", {}, false),

  logSale: (body: {
    sale_date?: string;
    amount_cents: number;
    payment_method: string;
    notes?: string;
    item_names?: string[];
    discount_cents?: number;
    discount_reason?: string;
    is_complimentary?: boolean;
    given_to?: string;
    given_to_employee_id?: string | null;
  }) =>
    request<Sale>("/api/ledgerly/revenue/sales", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listSales: (params: { from: string; to: string }) => {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    return request<Sale[]>(`/api/ledgerly/revenue/sales?${q.toString()}`);
  },

  // Sets who an existing discount / complimentary bill was given to.
  updateSaleRecipient: (id: string, body: { given_to?: string; given_to_employee_id?: string | null }) =>
    request<Sale>(`/api/ledgerly/revenue/sales/${id}/recipient`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Past non-staff recipient names, most recent first — for suggestions.
  listRecipientNames: () => request<string[]>("/api/ledgerly/revenue/recipients"),

  deleteSale: (id: string) =>
    request<void>(`/api/ledgerly/revenue/sales/${id}`, { method: "DELETE" }),

  listPayments: (params: { category?: string; from: string; to: string }) => {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    if (params.category) q.set("category", params.category);
    return request<Payment[]>(`/api/ledgerly/payments/?${q.toString()}`);
  },

  listDeliveryExpenses: (params: { from: string; to: string }) => {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    return request<DeliveryExpense[]>(`/api/ledgerly/purchases?${q.toString()}`);
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

  pnlTrend: (range: "week" | "month", periods: number, anchorDate?: string) =>
    request<{ range: string; periods: PnlTrendPoint[] }>(
      `/api/ledgerly/summary/pnl/trend?range=${range}&periods=${periods}${anchorDate ? `&anchor_date=${anchorDate}` : ""}`,
    ),

  expenseTrend: (periods: number, anchorDate: string) =>
    request<ExpenseTrend>(
      `/api/ledgerly/summary/expenses/trend?periods=${periods}&anchor_date=${anchorDate}`,
    ),
};
