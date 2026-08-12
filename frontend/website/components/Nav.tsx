"use client";

import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "About" },
  { href: "/gallery", label: "Gallery" },
  { href: "/reservations", label: "Reservations" },
  { href: "/contact", label: "Contact" },
];

export default function Nav({ businessName }: { businessName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur border-b border-navy/10">
      <div className="mx-auto max-w-6xl px-5 flex items-center justify-between h-16">
        <Link
          href="/"
          data-gtm-event="nav_click"
          data-gtm-label="Logo"
          data-gtm-location="header"
          className="font-display text-xl text-navy tracking-wide"
        >
          {businessName}
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-gtm-event="nav_click"
              data-gtm-label={link.label}
              data-gtm-location="desktop_nav"
              className="text-sm font-medium text-navy/80 hover:text-teal transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          className="md:hidden text-navy"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          data-gtm-event="nav_toggle"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-navy/10 px-5 py-3 flex flex-col gap-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-gtm-event="nav_click"
              data-gtm-label={link.label}
              data-gtm-location="mobile_nav"
              className="text-sm font-medium text-navy/80 hover:text-teal transition-colors"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
