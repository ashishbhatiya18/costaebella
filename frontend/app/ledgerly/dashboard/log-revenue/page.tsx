import { getMenu } from "@/lib/data";
import { LogRevenueClient } from "@/components/ledgerly/log-revenue-client";

// Server component so we can read menu.yaml at build time (fs access isn't
// available in the client component below) and hand down a plain list of
// dish names to tag against each sale — this is what lets Menuly later
// compute per-dish revenue from Ledgerly's sales data.
export default function LogRevenuePage() {
  const menu = getMenu();
  const names = new Set<string>();
  for (const category of [...menu.coffee, ...menu.food]) {
    for (const item of category.items) {
      names.add(item.name);
    }
  }
  const menuItems = [...names].sort((a, b) => a.localeCompare(b));

  return <LogRevenueClient menuItems={menuItems} />;
}
