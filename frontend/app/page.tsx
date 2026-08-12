import Image from "next/image";
import Link from "next/link";
import { getBusiness, getGallery } from "@/lib/data";

export default function Home() {
  const business = getBusiness();
  const gallery = getGallery();
  const heroPhoto = gallery.photos[0];

  return (
    <div>
      <section className="relative h-[80vh] min-h-[520px] flex items-end">
        <Image
          src={heroPhoto.src}
          alt={heroPhoto.alt}
          fill
          priority
          className="object-cover -z-10"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/40 to-navy/10 -z-10" />

        <div className="mx-auto max-w-6xl px-5 pb-16 w-full text-cream">
          <p className="uppercase tracking-[0.3em] text-sand text-xs mb-4">
            Good Coffee · Bigger Places · Brighter Days
          </p>
          <h1 className="font-display text-5xl sm:text-6xl mb-4 max-w-xl">
            {business.name}
          </h1>
          <p className="text-lg text-cream/90 max-w-md mb-8">{business.tagline}</p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/menu"
              data-gtm-event="view_menu"
              data-gtm-location="home_hero"
              className="bg-coral text-cream px-6 py-3 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
            >
              View Menu
            </Link>
            <Link
              href="/reservations"
              data-gtm-event="reserve_table"
              data-gtm-location="home_hero"
              className="border border-cream/60 text-cream px-6 py-3 rounded-full text-sm font-medium hover:bg-cream/10 transition-colors"
            >
              Reserve a Table
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h2 className="font-display text-3xl text-navy mb-6">About Us</h2>
        <p className="text-navy/80 leading-relaxed text-lg">{business.description}</p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl text-navy mb-3">From the Kitchen</h2>
          <p className="text-navy/70">A taste of what's on the menu.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {gallery.food.slice(0, 4).map((photo) => (
            <Link
              key={photo.src}
              href="/gallery"
              data-gtm-event="food_photo_click"
              data-gtm-label={photo.alt}
              data-gtm-location="home"
              className="relative aspect-square rounded-2xl overflow-hidden border border-navy/10 block"
            >
              <Image src={photo.src} alt={photo.alt} fill className="object-cover" />
            </Link>
          ))}
        </div>
        <div className="text-center">
          <Link
            href="/gallery"
            data-gtm-event="view_gallery"
            data-gtm-location="home"
            className="inline-block text-teal text-sm font-medium hover:underline"
          >
            See more photos →
          </Link>
        </div>
      </section>

      <section className="bg-teal/5 py-20">
        <div className="mx-auto max-w-6xl px-5 grid gap-6 sm:grid-cols-3 text-center">
          <div className="bg-cream rounded-2xl p-8 shadow-sm border border-navy/5">
            <h3 className="font-display text-xl text-navy mb-2">Speciality Coffee</h3>
            <p className="text-sm text-navy/70">
              Espresso, matcha, cold brews and hand-crafted frappes.
            </p>
          </div>
          <div className="bg-cream rounded-2xl p-8 shadow-sm border border-navy/5">
            <h3 className="font-display text-xl text-navy mb-2">Goan &amp; Global Bites</h3>
            <p className="text-sm text-navy/70">
              Coastal Goan starters alongside pizza, pasta and Chinese favourites.
            </p>
          </div>
          <div className="bg-cream rounded-2xl p-8 shadow-sm border border-navy/5">
            <h3 className="font-display text-xl text-navy mb-2">Beachside Vibes</h3>
            <p className="text-sm text-navy/70">
              A tropical escape in Kalyan, open every day from noon till late.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 text-center">
        <h2 className="font-display text-3xl text-navy mb-3">Visit Us</h2>
        <p className="text-navy/70 mb-8">
          {business.address.line1}, {business.address.line2}
        </p>
        <a
          href={business.address.google_maps_url}
          target="_blank"
          rel="noopener noreferrer"
          data-gtm-event="get_directions"
          data-gtm-location="home_visit_section"
          className="inline-block bg-navy text-cream px-6 py-3 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Get Directions
        </a>
      </section>
    </div>
  );
}
