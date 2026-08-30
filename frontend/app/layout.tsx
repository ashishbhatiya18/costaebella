import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import WhatsAppButton from "@/components/WhatsAppButton";
import PwaRegister from "@/components/PwaRegister";
import { GTMScript, GTMNoScript } from "@/components/GoogleTagManager";
import { getBusiness } from "@/lib/data";
import { buildRestaurantSchema } from "@/lib/structured-data";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#16302e",
};

export function generateMetadata(): Metadata {
  const business = getBusiness();
  const title = `${business.name} | ${business.tagline}`;
  const ogImage = `${business.site_url}/images/og/costa-e-bella-og.jpg`;

  return {
    metadataBase: new URL(business.site_url),
    title: {
      default: title,
      template: `%s | ${business.name}`,
    },
    description: business.description,
    keywords: [
      "Costa e Bella",
      "Goan restaurant Kalyan",
      "speciality coffee Kalyan",
      "cafe Kalyan",
      "Goan food Kalyan",
      "coffee shop Kalyan West",
    ],
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title,
      description: business.description,
      url: business.site_url,
      siteName: business.name,
      locale: "en_IN",
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: business.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: business.description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: business.name,
    },
    icons: {
      icon: [{ url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  const business = getBusiness();
  const restaurantSchema = buildRestaurantSchema(business);

  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <GTMScript gtmId={business.analytics.gtm_id} />
      </head>
      <body className="min-h-full flex flex-col bg-cream">
        <GTMNoScript gtmId={business.analytics.gtm_id} />
        <JsonLd data={restaurantSchema} />
        <Nav businessName={business.name} />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsAppButton phone={business.contact.phone_primary} businessName={business.name} />
        <PwaRegister />
      </body>
    </html>
  );
}
