import { getMenu } from "@/lib/data";
import { MenulyAnalyticsClient } from "@/components/menuly/analytics-client";

// Server component so we can read menu.yaml at build time for dish prices
// (used to value complimentary dishes). Keys match the names Ledgerly tags
// sales with — "Name (Variant)" for variant-priced dishes, see
// app/ledgerly/dashboard/log-revenue/page.tsx.
export default function MenulyAnalyticsPage() {
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

  return <MenulyAnalyticsClient prices={prices} />;
}
