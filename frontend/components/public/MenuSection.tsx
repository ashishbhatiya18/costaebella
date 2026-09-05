"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { MenuCategory } from "@/lib/data";
import { fetchPublicHiddenItems } from "@/lib/menuly/api";

const VARIANT_LABELS: Record<string, string> = {
  veg: "Veg",
  chicken: "Chicken",
  prawns: "Prawns",
  egg: "Egg",
  fish: "Fish",
};

// Client component so 86'd items can be hidden without a full static-export
// rebuild — categories/items are still baked in at build time (unchanged
// for SEO/structured data), we just filter out hidden ones once the
// visibility list loads. Items are briefly visible until that fetch
// resolves; an unreachable backend just leaves everything visible.
export default function MenuSection({ categories }: { categories: MenuCategory[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPublicHiddenItems().then((names) => setHidden(new Set(names)));
  }, []);

  const visibleCategories = categories
    .map((cat) => ({ ...cat, items: cat.items.filter((item) => !hidden.has(item.name)) }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div className="space-y-14">
      {visibleCategories.map((cat) => (
        <div key={cat.category} data-gtm-event="view_menu_category" data-gtm-label={cat.category}>
          <h3 className="font-display text-2xl text-teal mb-6 border-b border-teal/20 pb-2">
            {cat.category}
          </h3>
          <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {cat.items.map((item) => (
              <div key={item.name} className="flex gap-4">
                {item.image && (
                  <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-navy/10">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-navy">
                      {item.name}
                      {item.special && (
                        <span className="ml-2 text-xs text-coral align-middle">★</span>
                      )}
                    </span>
                    {item.price !== undefined && (
                      <span className="text-navy/70 text-sm whitespace-nowrap">
                        ₹{item.price}
                      </span>
                    )}
                  </div>

                  {item.prices && (
                    <div className="flex flex-wrap gap-x-4 text-sm text-navy/70 mt-1">
                      {Object.entries(item.prices).map(([variant, price]) => (
                        <span key={variant}>
                          {VARIANT_LABELS[variant] ?? variant}: ₹{price}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.description && (
                    <p className="text-sm text-navy/60 mt-1">{item.description}</p>
                  )}
                  {item.note && (
                    <p className="text-xs text-navy/50 italic mt-1">{item.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
