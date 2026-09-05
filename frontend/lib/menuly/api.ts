// Menuly-specific endpoints. Menu content itself (name/price/description)
// stays in frontend/data/menu.yaml — this only talks to the backend's
// visibility table (which items are currently hidden/86'd) and reads
// Ledgerly's per-sale entries for dish-level analytics.
import { apiRequest } from "@/lib/admin/api";

export { ApiError } from "@/lib/admin/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequest<T>(path, options, "/admin/login");
}

export type CompositionEntry = {
  id: string;
  item_name: string;
  pantrly_item_id: string;
  pantrly_item_name: string;
  pantrly_unit: string;
  quantity_per_order: number;
};

export const api = {
  listHidden: () => request<{ hidden_items: string[] }>("/api/menuly/visibility"),
  setVisibility: (itemName: string, hidden: boolean) =>
    request<void>("/api/menuly/visibility", {
      method: "PUT",
      body: JSON.stringify({ item_name: itemName, hidden }),
    }),

  // Omit itemName to get every dish's recipe at once (used for consumption
  // reconciliation against Pantrly's actual counted consumption).
  listComposition: (itemName?: string) => {
    const q = itemName ? `?item_name=${encodeURIComponent(itemName)}` : "";
    return request<CompositionEntry[]>(`/api/menuly/composition${q}`);
  },

  setComposition: (itemName: string, pantrlyItemId: string, quantityPerOrder: number) =>
    request<CompositionEntry>("/api/menuly/composition", {
      method: "PUT",
      body: JSON.stringify({
        item_name: itemName,
        pantrly_item_id: pantrlyItemId,
        quantity_per_order: quantityPerOrder,
      }),
    }),

  deleteComposition: (id: string) =>
    request<void>(`/api/menuly/composition/${id}`, { method: "DELETE" }),
};

// Unauthenticated fetch used by the public marketing site — no admin
// session exists there, so this must never go through apiRequest (which
// redirects to /admin/login on failure). Fails soft: an unreachable
// backend just means nothing gets hidden, not a broken menu page.
export async function fetchPublicHiddenItems(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/menuly/visibility/public`);
    if (!res.ok) return [];
    const data = (await res.json()) as { hidden_items?: string[] };
    return data.hidden_items ?? [];
  } catch {
    return [];
  }
}
