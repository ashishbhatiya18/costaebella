import Image from "next/image";
import type { Metadata } from "next";
import { getBusiness } from "@/lib/data";

export const metadata: Metadata = {
  title: "About | Costa e Bella",
};

export default function AboutPage() {
  const business = getBusiness();

  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <header className="text-center mb-12">
        <p className="uppercase tracking-[0.3em] text-teal text-xs mb-3">About</p>
        <h1 className="font-display text-4xl text-navy mb-6">About {business.name}</h1>
        <p className="text-navy/80 leading-relaxed text-lg max-w-2xl mx-auto">
          {business.description}
        </p>
      </header>

      <div className="rounded-2xl overflow-hidden border border-navy/10 mb-12">
        <Image
          src="/images/menu/about-back-cover.jpg"
          alt="About Costa e Bella"
          width={2000}
          height={1333}
          className="w-full h-auto"
        />
      </div>

      <div className="grid gap-8 sm:grid-cols-3 text-center">
        <div>
          <h3 className="font-display text-lg text-navy mb-1">Coastal Cuisine</h3>
          <p className="text-sm text-navy/60">Goan recipes rooted in tradition.</p>
        </div>
        <div>
          <h3 className="font-display text-lg text-navy mb-1">Seafood Vibes</h3>
          <p className="text-sm text-navy/60">Fresh seafood specialties on every menu.</p>
        </div>
        <div>
          <h3 className="font-display text-lg text-navy mb-1">Speciality Coffee</h3>
          <p className="text-sm text-navy/60">Handcrafted coffee, brewed with care.</p>
        </div>
      </div>
    </div>
  );
}
