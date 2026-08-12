# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Two things sharing one repo and one deploy pipeline:

1. **A public marketing site** for Costa È Bella, a Goan/Chinese cafe-restaurant in Kalyan, Maharashtra (`frontend/`, all content-facing routes) — static export, deployed to Cloudflare Pages.
2. **An `/admin` area** bolted onto that same Next.js app: Google-Sign-In-gated login, a launcher, and **Shiftly**, a staff attendance/payout tracker (`frontend/app/admin/**`, backed by the Go API in `backend/`). Shiftly used to be its own separate repo/product; it was merged in here as the first (and so far only) app behind the admin launcher, so more apps can be added the same way later without spinning up new repos.

The frontend is a single static export — there is no server runtime, so the admin area's auth is entirely client-side (see Architecture below), not Next middleware.

## Commands

Root `Taskfile.yml` orchestrates both halves (`dotenv: [".env"]`, so it reads the root `.env`):

```bash
task dev              # postgres (docker) + Go API + Next dev server, all together
task db:up            # start postgres only
task db:down          # stop containers
task backend:build    # go build -o bin/api ./cmd/api
task backend:test     # go test ./...
task frontend:install # npm install
task frontend:build   # static export -> frontend/out (must succeed before shipping any change)
task docker:build     # build the backend image via docker-compose
task docker:up        # postgres + backend via docker-compose
```

Or per-directory, without Task:

```bash
# frontend/
npm run dev      # dev server at localhost:3000
npm run build    # static export -> out/
npm run lint     # eslint

# backend/
go build -o bin/api ./cmd/api
go test ./...
go vet ./...
```

There is no frontend test suite — verify frontend changes with `npm run build` (fails loudly on type errors and static-export-incompatible code) and, for visual changes, `npm run dev` + a manual browser check. Backend has `go test`.

Local env vars live in `.env` (see `.env.example`) at the repo root, sourced by both Task and `docker-compose.yml`. The frontend additionally needs its own `frontend/.env.local` for `NEXT_PUBLIC_*` vars (`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) since those get baked in at build time.

## Architecture

### Public site (`frontend/app/{page,menu,about,gallery,reservations,contact}`)

**Everything content-related lives in YAML, not code.** `frontend/data/business.yaml`, `menu.yaml`, `gallery.yaml` are the single source of truth for contact info, hours, the full menu (prices, descriptions, variants), and photos. `lib/data.ts` loads and types them (`getBusiness()`, `getMenu()`, `getGallery()`) via `js-yaml`. Pages and components never hardcode business facts — they read through these getters. When asked to change a phone number, price, hours, or photo, edit the YAML, not the component.

**Static export constraints** (`next.config.ts` has `output: "export"`, `images.unoptimized: true`) apply repo-wide, including `/admin`:
- No API routes, no server actions, no `next/image` optimization at request time.
- `app/sitemap.ts` and `app/robots.ts` must declare `export const dynamic = "force-static"` or the export build fails.
- Public pages are server components reading YAML at build time. Admin pages are client components (see below) since they need runtime auth state and API calls.

**Images**: raw source photos live in `frontend/images/` (tracked in git — HEIC originals plus WhatsApp exports, kept as source material). Optimized/resized versions actually served by the site live in `public/images/{restaurant,food,menu,og}/`. When adding new photos: convert HEIC with `sips`, resize/compress with ImageMagick (`magick`), drop the result in the matching `public/images/` subfolder, then reference it from the relevant YAML file (`gallery.yaml` for gallery/homepage photos, or an `image:` field on a `menu.yaml` item).

**SEO / structured data** (`lib/structured-data.ts`): `buildRestaurantSchema()` and `buildMenuSchema()` generate JSON-LD directly from the YAML data — the Menu schema is built from every `menu.yaml` category/item, including per-variant pricing (Veg/Chicken/Prawns/Egg/Fish). Rendered via `components/JsonLd.tsx`. Each page's `generateMetadata()` sets its own title/description/canonical; `business.site_url` in `business.yaml` is the base for all absolute URLs, canonicals, and the sitemap.

**Analytics**: GTM container ID lives in `business.yaml` under `analytics.gtm_id` (blank disables it). The GTM `<script>` is rendered as a plain `<script>` tag inside an explicit `<head>` in `app/layout.tsx` — **do not switch this to `next/script`'s `beforeInteractive`/`afterInteractive` strategies**, they inject into `<body>` at runtime rather than literally in `<head>`, which fails Google's GTM installation check. Interactive elements site-wide carry `data-gtm-event` (and often `data-gtm-location` / `data-gtm-label`) attributes as stable hooks for GTM click/visibility triggers — tag new CTAs/links the same way.

**Conventions**: reservations are phone/WhatsApp-only (no booking form) — `components/WhatsAppButton.tsx` exports `buildWhatsAppUrl()`, reused anywhere a WhatsApp deep link is needed. Menu items can have either a flat `price` or a `prices: { veg, chicken, ... }` variant map — `components/MenuSection.tsx` and `lib/structured-data.ts` both branch on which is present; keep them in sync if the `MenuItem` shape changes. Tailwind v4, custom theme colors (`navy`, `teal`, `sand`, `coral`, `cream`) defined in `app/globals.css`, exposed as Tailwind utility classes via `@theme inline`. The admin area was restyled to reuse this same palette rather than its original dark theme — match it, don't diverge.

### Admin area (`frontend/app/admin/**`)

**Auth is Google Sign-In only, client-side, no cookies/middleware.** Because the whole site is a static export, there's no server to run middleware or set httpOnly cookies against. `lib/admin/api.ts` stores the JWT + email in `localStorage`, `lib/admin/auth-context.tsx` (`AuthProvider`/`useAuth`) wraps everything under `app/admin/layout.tsx` and redirects to `/admin/login` if unauthenticated. Token changes (`setToken`/`clearToken`) dispatch a custom `admin-auth-change` `window` event so other mounted components (notably the public site's `components/Nav.tsx`, which persists across client-side navigations and shows Login/Logout based on session state) can react without a full reload.

`app/admin/page.tsx` is the launcher — a typed array of `{name, href, description}` app tiles, currently just Shiftly. Add future admin apps by extending that array and adding a new route under `app/admin/<app>/**`, following the same pattern Shiftly uses.

**Shiftly** (`app/admin/shiftly/**`, `components/shiftly/**`, `lib/shiftly/**`): staff attendance/payout tracker. `lib/shiftly/api.ts` builds on the shared `apiRequest`/`adminApi` helpers in `lib/admin/api.ts` rather than duplicating auth/fetch logic. `app/admin/shiftly/dashboard/layout.tsx` is the sidebar/nav chrome for its four pages (log attendance, manage employees, attendance summary, payout summary); auth is already gated once at `app/admin/layout.tsx`, so this layout only reads `email`/`isLoading` from context, it doesn't re-check auth itself. `app/admin/shiftly/login/page.tsx` is legacy/unreachable in practice (the site-level guard redirects to `/admin/login` before it would ever render) — kept styled-consistent but not the real entry point.

Per-page browser tab titles are set via `lib/admin/use-page-title.ts` (`usePageTitle(title)`), since client components can't use `generateMetadata`.

### Backend (`backend/`, Go, module `attendance-app/costaebella-backend`)

Standard layered structure: `cmd/api/main.go` wires everything and starts a `chi` router; `internal/<domain>/{handler,repo,models}.go` per domain (`auth`, `employee`, `attendance`, `payout`); `internal/db/db.go` embeds and auto-applies `migrations_sql/*.up.sql` on every boot (no separate migrate step — `task db:migrate` is just a no-op alias for discoverability); `internal/middleware/middleware.go` has `RequireAuth`, `CORS`, `Logging`.

**Auth**: Google Sign-In only, no passwords. `POST /api/auth/google` exchanges a Google ID token for a JWT, but only if the resulting email exists in the `admins` table — a whitelist, not open signup. `config.AdminEmail` (from `.env`) is upserted into that table on every boot via `SeedWhitelistedEmail` (`internal/auth/auth.go`) — to grant someone access, set `ADMIN_EMAIL` and restart the backend, or insert directly into `admins`. All other `/api/**` routes require `Authorization: Bearer <jwt>` via `RequireAuth`.

**Background job**: `internal/reconcile` runs every 5 minutes (`go reconcile.Run(...)` in `main.go`) to auto-close attendance logs where an employee forgot to log out, so a missed logout doesn't skew hours-worked/payout math indefinitely.

**Deploy target**: Raspberry Pi (arm64/armv8). `backend/Dockerfile` cross-compiles natively via `--platform=$BUILDPLATFORM` (avoids slow/flaky QEMU for the Go build itself) and produces a static (`CGO_ENABLED=0`) binary onto a `gcr.io/distroless/static-debian12:nonroot` final stage — no shell, no package manager, runs non-root. `.github/workflows/backend-image.yml` builds+pushes `linux/arm64` to `ghcr.io/<owner>/<repo>-backend` on every push to `main` touching `backend/**`, using the built-in `GITHUB_TOKEN`.

## Deploy

Frontend: static export, deployed via Cloudflare Pages' native Git integration (builds on push itself — not handled by GitHub Actions). Backend: GitHub Actions builds the arm64 Docker image on push to `main`; running it on the Pi (pulling the new image, restarting the container) is a separate, manual/external step not automated in this repo.
