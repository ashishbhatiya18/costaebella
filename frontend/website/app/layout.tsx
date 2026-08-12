import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getBusiness } from "@/lib/data";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export function generateMetadata(): Metadata {
  const business = getBusiness();
  return {
    title: `${business.name} | ${business.tagline}`,
    description: business.description,
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  const business = getBusiness();

  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream">
        <Nav businessName={business.name} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
