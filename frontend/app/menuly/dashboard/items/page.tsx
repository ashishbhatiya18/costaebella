import { getMenu } from "@/lib/data";
import { MenulyItemsClient, MenulyCategory } from "@/components/menuly/items-client";

// Server component so we can read menu.yaml at build time — the item list
// (names/prices) is static, only its hide/show state is dynamic.
export default function MenulyItemsPage() {
  const menu = getMenu();
  const categories: MenulyCategory[] = [...menu.coffee, ...menu.food].map((cat) => ({
    category: cat.category,
    items: cat.items.map((item) => ({ name: item.name, price: item.price ?? null })),
  }));

  return <MenulyItemsClient categories={categories} />;
}
