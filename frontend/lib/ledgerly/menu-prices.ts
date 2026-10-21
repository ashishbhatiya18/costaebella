import { getMenu } from "@/lib/data";

// Menu price (₹) per dish name, keyed the way Ledgerly tags sales —
// "Name (Variant)" for variant-priced dishes (see
// app/ledgerly/dashboard/log-revenue/page.tsx). Reads menu.yaml, so only
// call it from a server component at build time.
export function getMenuPrices(): Record<string, number> {
  const menu = getMenu();
  const prices: Record<string, number> = {};
  for (const category of [...menu.coffee, ...menu.food]) {
    for (const item of category.items) {
      if (item.prices) {
        for (const [variant, price] of Object.entries(item.prices)) {
          const label = variant.charAt(0).toUpperCase() + variant.slice(1);
          prices[`${item.name} (${label})`] = price;
        }
      } else if (item.price != null) {
        prices[item.name] = item.price;
      }
    }
  }
  return prices;
}
