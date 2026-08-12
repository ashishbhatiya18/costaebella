import Image from "next/image";
import type { Metadata } from "next";
import { getMenu } from "@/lib/data";
import MenuSection from "@/components/MenuSection";

export const metadata: Metadata = {
  title: "Menu | Costa e Bella",
};

export default function MenuPage() {
  const menu = getMenu();

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <header className="text-center mb-16">
        <p className="uppercase tracking-[0.3em] text-teal text-xs mb-3">Menu</p>
        <h1 className="font-display text-4xl text-navy">Coffee &amp; Kitchen</h1>
      </header>

      <section className="mb-24">
        <h2 className="font-display text-3xl text-navy mb-10">Coffee, Matcha &amp; Coolers</h2>
        <MenuSection categories={menu.coffee} />
      </section>

      <section className="mb-24">
        <h2 className="font-display text-3xl text-navy mb-10">Food</h2>
        <MenuSection categories={menu.food} />
      </section>

      <section>
        <h2 className="font-display text-3xl text-navy mb-8 text-center">
          Original Menu Cards
        </h2>
        <div className="grid gap-8 sm:grid-cols-2">
          {menu.images.map((img) => (
            <div key={img.src} className="rounded-2xl overflow-hidden border border-navy/10">
              <Image
                src={img.src}
                alt={img.alt}
                width={2000}
                height={1333}
                className="w-full h-auto"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
