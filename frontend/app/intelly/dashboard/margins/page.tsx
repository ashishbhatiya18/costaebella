import { getMenu } from "@/lib/data";
import { MarginsClient } from "@/components/intelly/margins-client";

// Server component so we can read menu.yaml at build time for dish prices.
export default function IntellyMarginsPage() {
  const menu = getMenu();
  const prices: Record<string, number> = {};
  for (const category of [...menu.coffee, ...menu.food]) {
    for (const item of category.items) {
      if (item.price != null) prices[item.name] = item.price;
    }
  }

  return <MarginsClient prices={prices} />;
}
