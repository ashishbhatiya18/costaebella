import type { Business, MenuData } from "@/lib/data";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function parseHours(hoursText: string): { opens: string; closes: string } {
  // "12:00 PM - 11:00 PM" -> { opens: "12:00", closes: "23:00" }
  const [openRaw, closeRaw] = hoursText.split("-").map((s) => s.trim());
  const to24h = (time: string) => {
    const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return time;
    let [, h, m, period] = match;
    let hour = parseInt(h, 10);
    if (/PM/i.test(period) && hour !== 12) hour += 12;
    if (/AM/i.test(period) && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${m}`;
  };
  return { opens: to24h(openRaw), closes: to24h(closeRaw) };
}

export function buildRestaurantSchema(business: Business) {
  const { opens, closes } = parseHours(business.hours.monday_to_sunday);

  return {
    "@context": "https://schema.org",
    "@type": ["Restaurant", "CafeOrCoffeeShop"],
    "@id": `${business.site_url}/#restaurant`,
    name: business.name,
    description: business.description,
    url: business.site_url,
    telephone: business.contact.phone_primary,
    email: business.contact.email,
    image: `${business.site_url}/images/og/costa-e-bella-og.jpg`,
    servesCuisine: ["Goan", "Chinese", "Continental", "Coffee", "Cafe"],
    priceRange: "₹₹",
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address.line1,
      addressLocality: "Kalyan",
      addressRegion: "Maharashtra",
      addressCountry: "IN",
    },
    hasMap: business.address.google_maps_url,
    sameAs: [business.contact.instagram_url],
    menu: `${business.site_url}/menu`,
    acceptsReservations: "True",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DAYS_OF_WEEK,
      opens,
      closes,
    },
  };
}

function priceToOffer(price: number) {
  return {
    "@type": "Offer",
    price: price.toString(),
    priceCurrency: "INR",
  };
}

const VARIANT_LABELS: Record<string, string> = {
  veg: "Veg",
  chicken: "Chicken",
  prawns: "Prawns",
  egg: "Egg",
  fish: "Fish",
};

export function buildMenuSchema(menu: MenuData, business: Business) {
  const buildSections = (categories: MenuData["coffee"]) =>
    categories.map((cat) => ({
      "@type": "MenuSection",
      name: cat.category,
      hasMenuItem: cat.items.flatMap((item) => {
        if (item.price !== undefined) {
          return [
            {
              "@type": "MenuItem",
              name: item.name,
              description: item.description,
              offers: priceToOffer(item.price),
            },
          ];
        }
        if (item.prices) {
          return Object.entries(item.prices).map(([variant, price]) => ({
            "@type": "MenuItem",
            name: `${item.name} (${VARIANT_LABELS[variant] ?? variant})`,
            description: item.description,
            offers: priceToOffer(price),
          }));
        }
        return [];
      }),
    }));

  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${business.site_url}/menu#menu`,
    name: `${business.name} Menu`,
    inLanguage: "en",
    url: `${business.site_url}/menu`,
    hasMenuSection: [
      ...buildSections(menu.coffee),
      ...buildSections(menu.food),
    ],
  };
}
