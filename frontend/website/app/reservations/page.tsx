import type { Metadata } from "next";
import { getBusiness } from "@/lib/data";
import { buildWhatsAppUrl } from "@/components/WhatsAppButton";

export function generateMetadata(): Metadata {
  const business = getBusiness();
  const description = `Reserve a table at ${business.name} by phone: ${business.contact.phone_primary}. Open daily ${business.hours.monday_to_sunday}.`;
  return {
    title: "Reservations",
    description,
    alternates: { canonical: "/reservations" },
    openGraph: { title: `Reservations | ${business.name}`, description, url: "/reservations" },
  };
}

export default function ReservationsPage() {
  const business = getBusiness();

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 text-center">
      <p className="uppercase tracking-[0.3em] text-teal text-xs mb-3">Reservations</p>
      <h1 className="font-display text-4xl text-navy mb-6">Reserve a Table</h1>
      <p className="text-navy/70 mb-10">{business.reservations.note}</p>

      <div className="bg-teal/5 rounded-2xl p-10 border border-navy/5 inline-block">
        <p className="text-sm text-navy/60 mb-2">Call us to book</p>
        <a
          href={`tel:${business.contact.phone_primary.replace(/\s/g, "")}`}
          data-gtm-event="call_click"
          className="font-display text-3xl text-navy hover:text-teal transition-colors"
        >
          {business.contact.phone_primary}
        </a>
        <p className="text-navy/60 text-sm mt-2">
          or{" "}
          <a
            href={`tel:${business.contact.phone_secondary.replace(/\s/g, "")}`}
            data-gtm-event="call_click"
            className="hover:underline"
          >
            {business.contact.phone_secondary}
          </a>
        </p>
        <p className="text-navy/50 text-xs mt-6 mb-4">
          Open daily {business.hours.monday_to_sunday}
        </p>
        <a
          href={buildWhatsAppUrl(business.contact.phone_primary, `Hi ${business.name}! I'd like to reserve a table.`)}
          target="_blank"
          rel="noopener noreferrer"
          data-gtm-event="whatsapp_click"
          className="inline-flex items-center gap-2 bg-[#25D366] text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
