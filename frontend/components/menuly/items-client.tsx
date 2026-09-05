"use client";

import { useEffect, useState } from "react";
import { api, CompositionEntry } from "@/lib/menuly/api";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Switch } from "@/components/admin/ui/switch";
import { CompositionModal } from "@/components/menuly/composition-modal";
import { clsx } from "@/lib/admin/clsx";
import { usePageTitle } from "@/lib/admin/use-page-title";

export type MenulyCategory = {
  category: string;
  items: { name: string; price: number | null }[];
};

export function MenulyItemsClient({ categories }: { categories: MenulyCategory[] }) {
  usePageTitle("Menu Items");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [itemsWithRecipe, setItemsWithRecipe] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [recipeItem, setRecipeItem] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [hiddenData, composition] = await Promise.all([api.listHidden(), api.listComposition()]);
      setHidden(new Set(hiddenData.hidden_items ?? []));
      setItemsWithRecipe(new Set((composition ?? []).map((c: CompositionEntry) => c.item_name)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(name: string) {
    const nextHidden = !hidden.has(name);
    setPending((prev) => new Set(prev).add(name));
    try {
      await api.setVisibility(name, nextHidden);
      setHidden((prev) => {
        const next = new Set(prev);
        if (nextHidden) next.add(name);
        else next.delete(name);
        return next;
      });
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  }

  const q = search.trim().toLowerCase();
  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      items: q ? cat.items.filter((i) => i.name.toLowerCase().includes(q)) : cat.items,
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-navy">Menu Items</h1>
        <p className="mt-1 text-sm text-navy/60">
          Toggle a dish off to hide it from the live public menu immediately — no rebuild needed.
          Name, price, and description are still edited in <code className="text-xs">menu.yaml</code>.
        </p>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search items…"
        className="mb-4"
      />

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : (
        <div className="space-y-6">
          {filteredCategories.map((cat) => (
            <Card key={cat.category} className="overflow-hidden">
              <div className="border-b border-navy/10 bg-cream/60 px-5 py-3 text-sm font-medium text-navy">
                {cat.category}
              </div>
              <ul className="divide-y divide-navy/5">
                {cat.items.map((item) => {
                  const isHidden = hidden.has(item.name);
                  const isPending = pending.has(item.name);
                  return (
                    <li key={item.name} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div className="min-w-0">
                        <span className={clsx("text-sm", isHidden ? "text-navy/40 line-through" : "text-navy")}>
                          {item.name}
                        </span>
                        {item.price != null && (
                          <span className="ml-2 text-xs text-navy/40">₹{item.price}</span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        <button
                          onClick={() => setRecipeItem(item.name)}
                          className={clsx(
                            "rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors",
                            itemsWithRecipe.has(item.name)
                              ? "border-teal/30 bg-teal/10 text-teal hover:bg-teal/20"
                              : "border-coral/30 bg-coral/10 text-coral hover:bg-coral/20",
                          )}
                        >
                          Recipe
                        </button>
                        <div className="flex items-center gap-2.5">
                          <span
                            className={clsx(
                              "w-12 text-right text-xs font-medium",
                              isHidden ? "text-coral" : "text-teal",
                            )}
                          >
                            {isHidden ? "Hidden" : "Visible"}
                          </span>
                          <Switch
                            checked={!isHidden}
                            onChange={() => toggle(item.name)}
                            disabled={isPending}
                            label={`Toggle visibility for ${item.name}`}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
          {filteredCategories.length === 0 && (
            <Card className="p-10 text-center text-navy/50">No items found.</Card>
          )}
        </div>
      )}

      {recipeItem && (
        <CompositionModal
          itemName={recipeItem}
          onClose={() => {
            setRecipeItem(null);
            load();
          }}
        />
      )}
    </div>
  );
}
