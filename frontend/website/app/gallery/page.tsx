import Image from "next/image";
import type { Metadata } from "next";
import { getBusiness, getGallery } from "@/lib/data";

export function generateMetadata(): Metadata {
  const business = getBusiness();
  const description = `Photos of food and the space at ${business.name}, our Goan continental and Chinese cafe in Kalyan West.`;
  return {
    title: "Gallery",
    description,
    alternates: { canonical: "/gallery" },
    openGraph: { title: `Gallery | ${business.name}`, description, url: "/gallery" },
  };
}

function PhotoGrid({ photos }: { photos: { src: string; alt: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {photos.map((photo) => (
        <div
          key={photo.src}
          className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-navy/10"
        >
          <Image src={photo.src} alt={photo.alt} fill className="object-cover" />
        </div>
      ))}
    </div>
  );
}

export default function GalleryPage() {
  const gallery = getGallery();

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <header className="text-center mb-12">
        <p className="uppercase tracking-[0.3em] text-teal text-xs mb-3">Gallery</p>
        <h1 className="font-display text-4xl text-navy">A Look Inside</h1>
      </header>

      <section className="mb-16">
        <h2 className="font-display text-2xl text-navy mb-6">Food &amp; Drinks</h2>
        <PhotoGrid photos={gallery.food} />
      </section>

      <section>
        <h2 className="font-display text-2xl text-navy mb-6">The Space</h2>
        <PhotoGrid photos={gallery.photos} />
      </section>
    </div>
  );
}
