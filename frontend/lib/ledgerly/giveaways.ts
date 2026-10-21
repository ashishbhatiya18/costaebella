import { Sale } from "@/lib/ledgerly/api";

// Shared by Log Income (where discounts / complimentary bills are logged)
// and the Giveaways page (where they're reported). The category of a
// giveaway is stored in Sale.discount_reason as plain text, so a typed
// "Other" category is just another value.

// "Other" in the category dropdown switches to a free-text field.
export const OTHER_CATEGORY = "__other__";

export const COMPLIMENTARY_CATEGORIES = [
  "Owner's guest",
  "Friends & family",
  "Staff meal",
  "Regular customer",
  "Complaint / service recovery",
  "Promotion / tasting",
];

export const DISCOUNT_CATEGORIES = [
  "Regular customer",
  "Friends & family",
  "Staff discount",
  "Offer / promotion",
  "Complaint / service recovery",
  "Bill rounded off",
];

// Picking one of these defaults "Given to" to a staff member.
export const STAFF_CATEGORIES = ["Staff meal", "Staff discount"];

export type RecipientType = "staff" | "other";

// Menu value of a complimentary bill's dishes (prices in ₹, from
// lib/ledgerly/menu-prices.ts). unpriced is true if any dish has no menu
// price — e.g. renamed since — and so isn't counted.
export function complimentaryValue(itemNames: string[], prices: Record<string, number>) {
  let cents = 0;
  let unpriced = false;
  for (const name of itemNames) {
    if (prices[name] != null) cents += Math.round(prices[name] * 100);
    else unpriced = true;
  }
  return { cents, unpriced };
}

// What a range's sales gave away: discounts taken off bills, and
// complimentary bills at menu value. The P&L adds both to sales *and* to
// expenses — income received already excludes them, so adding them only
// as an expense would count them twice — leaving profit unchanged.
export type Giveaways = { discountCents: number; complimentaryCents: number; unpriced: boolean };

export function giveawayTotals(sales: Sale[], prices: Record<string, number>): Giveaways {
  const out: Giveaways = { discountCents: 0, complimentaryCents: 0, unpriced: false };
  for (const s of sales) {
    if (s.is_complimentary) {
      const v = complimentaryValue(s.item_names ?? [], prices);
      out.complimentaryCents += v.cents;
      out.unpriced ||= v.unpriced;
    } else {
      out.discountCents += s.discount_cents;
    }
  }
  return out;
}
