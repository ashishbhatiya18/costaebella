import type { Metadata } from "next";
import { getBusiness } from "@/lib/data";
import { buildWhatsAppUrl } from "@/components/WhatsAppButton";

export function generateMetadata(): Metadata {
  const business = getBusiness();
  const description = `Get in touch with ${business.name} - address, phone, email and Instagram. ${business.address.line1}, ${business.address.line2}.`;
  return {
    title: "Contact",
    description,
    alternates: { canonical: "/contact" },
    openGraph: { title: `Contact | ${business.name}`, description, url: "/contact" },
  };
}

export default function ContactPage() {
  const business = getBusiness();

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <header className="text-center mb-12">
        <p className="uppercase tracking-[0.3em] text-teal text-xs mb-3">Contact</p>
        <h1 className="font-display text-4xl text-navy">Get in Touch</h1>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="bg-teal/5 rounded-2xl p-6 border border-navy/5">
          <h3 className="font-display text-lg text-navy mb-2">Address</h3>
          <p className="text-navy/70 text-sm">{business.address.line1}</p>
          <p className="text-navy/70 text-sm mb-3">{business.address.line2}</p>
          <a
            href={business.address.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            data-gtm-event="get_directions"
            data-gtm-location="contact_page"
            className="text-teal text-sm font-medium hover:underline"
          >
            Get Directions →
          </a>
        </div>

        <div className="bg-teal/5 rounded-2xl p-6 border border-navy/5">
          <h3 className="font-display text-lg text-navy mb-2">Phone</h3>
          <p className="text-navy/70 text-sm">
            <a
              href={`tel:${business.contact.phone_primary.replace(/\s/g, "")}`}
              data-gtm-event="call_click"
              data-gtm-location="contact_page"
              className="hover:underline"
            >
              {business.contact.phone_primary}
            </a>
          </p>
          <p className="text-navy/70 text-sm mb-3">
            <a
              href={`tel:${business.contact.phone_secondary.replace(/\s/g, "")}`}
              data-gtm-event="call_click"
              data-gtm-location="contact_page"
              className="hover:underline"
            >
              {business.contact.phone_secondary}
            </a>
          </p>
          <a
            href={buildWhatsAppUrl(business.contact.phone_primary, `Hi ${business.name}! I'd like to know more.`)}
            target="_blank"
            rel="noopener noreferrer"
            data-gtm-event="whatsapp_click"
            data-gtm-location="contact_page"
            className="text-teal text-sm font-medium hover:underline"
          >
            Chat on WhatsApp →
          </a>
        </div>

        <div className="bg-teal/5 rounded-2xl p-6 border border-navy/5">
          <h3 className="font-display text-lg text-navy mb-2">Email</h3>
          <a
            href={`mailto:${business.contact.email}`}
            data-gtm-event="email_click"
            data-gtm-location="contact_page"
            className="text-navy/70 text-sm hover:underline"
          >
            {business.contact.email}
          </a>
        </div>

        <div className="bg-teal/5 rounded-2xl p-6 border border-navy/5">
          <h3 className="font-display text-lg text-navy mb-2">Instagram</h3>
          <a
            href={business.contact.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            data-gtm-event="instagram_click"
            data-gtm-location="contact_page"
            className="text-navy/70 text-sm hover:underline"
          >
            @{business.contact.instagram_handle}
          </a>
        </div>
      </div>

      <div className="mt-8 text-center">
        <h3 className="font-display text-lg text-navy mb-1">Hours</h3>
        <p className="text-navy/70 text-sm">Open daily, {business.hours.monday_to_sunday}</p>
      </div>
    </div>
  );
}
