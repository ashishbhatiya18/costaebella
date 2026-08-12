# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A static marketing site for **Costa È Bella**, a Goan/Chinese cafe-restaurant in Kalyan, Maharashtra. Built with Next.js App Router, exported as fully static HTML (no server runtime), and deployed to Cloudflare Pages at `costaebella.pages.dev`.

## Commands

```bash
npm run dev      # dev server at localhost:3000
npm run build    # static export -> out/ (must succeed before shipping any change)
npm run lint     # eslint
```

There is no test suite. Verify changes with `npm run build` (fails loudly on type errors and on static-export-incompatible code) and, for visual changes, `npm run dev` + a manual check in the browser.

## Architecture

**Everything content-related lives in YAML, not code.** `data/business.yaml`, `data/menu.yaml`, `data/gallery.yaml` are the single source of truth for contact info, hours, the full menu (prices, descriptions, variants), and photos. `lib/data.ts` loads and types them (`getBusiness()`, `getMenu()`, `getGallery()`) via `js-yaml`. Pages and components never hardcode business facts — they read through these getters. When asked to change a phone number, price, hours, or photo, edit the YAML, not the component.

**Static export constraints** (`next.config.ts` has `output: "export"`, `images.unoptimized: true`):
- No API routes, no server actions, no `next/image` optimization at request time — images are pre-optimized at build time (see Images below) and served as-is.
- `app/sitemap.ts` and `app/robots.ts` must declare `export const dynamic = "force-static"` or the export build fails.
- All pages are server components reading YAML at build time; there is no client-side data fetching for content.

**Images**: raw source photos live in `images/` (tracked in git — HEIC originals plus WhatsApp exports, kept as source material). Optimized/resized versions actually served by the site live in `public/images/{restaurant,food,menu,og}/`. When adding new photos: convert HEIC with `sips`, resize/compress with ImageMagick (`magick`), drop the result in the matching `public/images/` subfolder, then reference it from the relevant YAML file (`gallery.yaml` for gallery/homepage photos, or an `image:` field on a `menu.yaml` item to show a thumbnail next to that dish).

**SEO / structured data** (`lib/structured-data.ts`): `buildRestaurantSchema()` and `buildMenuSchema()` generate JSON-LD directly from the YAML data — the Menu schema is built from every `menu.yaml` category/item, including per-variant pricing (Veg/Chicken/Prawns/Egg/Fish). Rendered via `components/JsonLd.tsx`. Each page's `generateMetadata()` sets its own title/description/canonical; `business.site_url` in `business.yaml` is the base for all absolute URLs, canonicals, and the sitemap.

**Analytics**: Google Tag Manager container ID lives in `business.yaml` under `analytics.gtm_id` (blank disables it). The GTM `<script>` is rendered as a plain `<script>` tag inside an explicit `<head>` in `app/layout.tsx` — **do not switch this to `next/script`'s `beforeInteractive`/`afterInteractive` strategies**, they inject into `<body>` at runtime rather than literally in `<head>`, which fails Google's GTM installation check. Interactive elements site-wide carry `data-gtm-event` (and often `data-gtm-location` / `data-gtm-label`) attributes as stable hooks for GTM click/visibility triggers — when adding a new CTA or link, tag it the same way rather than leaving it untracked.

**Routing**: standard App Router pages under `app/` — `/`, `/menu`, `/about`, `/gallery`, `/reservations`, `/contact`. `components/Nav.tsx` and `components/Footer.tsx` are shared across all pages via `app/layout.tsx`.

## Conventions

- Reservations are phone/WhatsApp-only (no booking form) — `components/WhatsAppButton.tsx` exports `buildWhatsAppUrl()`, reused anywhere a WhatsApp deep link is needed.
- Menu items can have either a flat `price` or a `prices: { veg, chicken, ... }` variant map — `components/MenuSection.tsx` and `lib/structured-data.ts` both branch on which is present; keep them in sync if the `MenuItem` shape changes.
- Tailwind v4 (via `@tailwindcss/postcss`), custom theme colors (`navy`, `teal`, `sand`, `coral`, `cream`) defined in `app/globals.css`.
