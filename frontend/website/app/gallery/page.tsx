import Image from "next/image";
import type { Metadata } from "next";
import { getGallery } from "@/lib/data";

export const metadata: Metadata = {
  title: "Gallery | Costa e Bella",
};

export default function GalleryPage() {
  const gallery = getGallery();

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <header className="text-center mb-12">
        <p className="uppercase tracking-[0.3em] text-teal text-xs mb-3">Gallery</p>
        <h1 className="font-display text-4xl text-navy">A Look Inside</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gallery.photos.map((photo) => (
          <div
            key={photo.src}
            className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-navy/10"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
