import { getBusiness } from "@/lib/data";

export default function Footer() {
  const business = getBusiness();

  return (
    <footer className="bg-navy text-cream/90 mt-24">
      <div className="mx-auto max-w-6xl px-5 py-12 grid gap-10 sm:grid-cols-3">
        <div>
          <h3 className="font-display text-lg text-sand mb-2">{business.name}</h3>
          <p className="text-sm text-cream/70">{business.tagline}</p>
        </div>

        <div className="text-sm space-y-1">
          <p>{business.address.line1}</p>
          <p>{business.address.line2}</p>
          <a
            href={business.address.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            data-gtm-event="get_directions"
            className="text-sand hover:underline"
          >
            View on Google Maps
          </a>
        </div>

        <div className="text-sm space-y-1">
          <p>
            <a
              href={`tel:${business.contact.phone_primary.replace(/\s/g, "")}`}
              data-gtm-event="call_click"
              className="hover:underline"
            >
              {business.contact.phone_primary}
            </a>
          </p>
          <p>
            <a
              href={`mailto:${business.contact.email}`}
              data-gtm-event="email_click"
              className="hover:underline"
            >
              {business.contact.email}
            </a>
          </p>
          <p>
            <a
              href={business.contact.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              data-gtm-event="instagram_click"
              className="hover:underline"
            >
              @{business.contact.instagram_handle}
            </a>
          </p>
          <p className="text-cream/70 pt-1">Open daily {business.hours.monday_to_sunday}</p>
        </div>
      </div>

      <div className="border-t border-cream/10 py-4 text-center text-xs text-cream/50">
        © {new Date().getFullYear()} {business.name}. All rights reserved.
      </div>
    </footer>
  );
}
