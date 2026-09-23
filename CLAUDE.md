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

### Public site (`frontend/app/(public)/{page,menu,about,gallery,reservations,contact}`)

The `(public)` segment is a Next.js route group — parens mean it's purely organizational and adds nothing to the URL, so routes are still `/`, `/menu`, `/about`, etc. `app/layout.tsx` (root layout), `app/globals.css`, `app/sitemap.ts`, `app/robots.ts`, and `app/favicon.ico` stay at the true app root since Next.js requires those there regardless of route groups; only the content pages live under `(public)`. Components used only by these pages live in `components/public/` (e.g. `MenuSection.tsx`); components shared across the whole site including admin/Shiftly (`Nav`, `Footer`, `JsonLd`, `GoogleTagManager`, `WhatsAppButton`) stay at `components/` root since the root layout renders them everywhere.

**Everything content-related lives in YAML, not code.** `frontend/data/business.yaml`, `menu.yaml`, `gallery.yaml` are the single source of truth for contact info, hours, the full menu (prices, descriptions, variants), and photos. `lib/data.ts` loads and types them (`getBusiness()`, `getMenu()`, `getGallery()`) via `js-yaml`. Pages and components never hardcode business facts — they read through these getters. When asked to change a phone number, price, hours, or photo, edit the YAML, not the component.

**Static export constraints** (`next.config.ts` has `output: "export"`, `images.unoptimized: true`) apply repo-wide, including `/admin`:
- No API routes, no server actions, no `next/image` optimization at request time.
- `app/sitemap.ts` and `app/robots.ts` must declare `export const dynamic = "force-static"` or the export build fails.
- Public pages are server components reading YAML at build time. Admin pages are client components (see below) since they need runtime auth state and API calls.

**Images**: raw source photos live in `frontend/images/` (tracked in git — HEIC originals plus WhatsApp exports, kept as source material). Optimized/resized versions actually served by the site live in `public/images/{restaurant,food,menu,og}/`. When adding new photos: convert HEIC with `sips`, resize/compress with ImageMagick (`magick`), drop the result in the matching `public/images/` subfolder, then reference it from the relevant YAML file (`gallery.yaml` for gallery/homepage photos, or an `image:` field on a `menu.yaml` item).

**SEO / structured data** (`lib/structured-data.ts`): `buildRestaurantSchema()` and `buildMenuSchema()` generate JSON-LD directly from the YAML data — the Menu schema is built from every `menu.yaml` category/item, including per-variant pricing (Veg/Chicken/Prawns/Egg/Fish). Rendered via `components/JsonLd.tsx`. Each page's `generateMetadata()` sets its own title/description/canonical; `business.site_url` in `business.yaml` is the base for all absolute URLs, canonicals, and the sitemap.

**Analytics**: GTM container ID lives in `business.yaml` under `analytics.gtm_id` (blank disables it). The GTM `<script>` is rendered as a plain `<script>` tag inside an explicit `<head>` in `app/layout.tsx` — **do not switch this to `next/script`'s `beforeInteractive`/`afterInteractive` strategies**, they inject into `<body>` at runtime rather than literally in `<head>`, which fails Google's GTM installation check. Interactive elements site-wide carry `data-gtm-event` (and often `data-gtm-location` / `data-gtm-label`) attributes as stable hooks for GTM click/visibility triggers — tag new CTAs/links the same way.

**Conventions**: reservations are phone/WhatsApp-only (no booking form) — `components/WhatsAppButton.tsx` exports `buildWhatsAppUrl()`, reused anywhere a WhatsApp deep link is needed. Menu items can have either a flat `price` or a `prices: { veg, chicken, ... }` variant map — `components/MenuSection.tsx` and `lib/structured-data.ts` both branch on which is present; keep them in sync if the `MenuItem` shape changes. Tailwind v4, custom theme colors (`navy`, `teal`, `sand`, `coral`, `cream`) defined in `app/globals.css`, exposed as Tailwind utility classes via `@theme inline`. The admin area was restyled to reuse this same palette rather than its original dark theme — match it, don't diverge.

### Admin area (`frontend/app/admin/**` launcher + `frontend/app/<app>/**` per app)

**Auth is Google Sign-In only, client-side, no cookies/middleware.** Because the whole site is a static export, there's no server to run middleware or set httpOnly cookies against. `lib/admin/api.ts` stores the JWT + email in `localStorage`, `lib/admin/auth-context.tsx` (`AuthProvider`/`useAuth`) provides the session. `lib/admin/admin-guard.tsx` (`AdminGuard`) wraps the auth-provider + redirect-if-unauthenticated logic once so every gated top-level layout can reuse it instead of duplicating the check. `app/admin/layout.tsx` uses it to gate `/admin/**` (the launcher + `/admin/login`); each app has its own top-level layout doing the same (e.g. `app/shiftly/layout.tsx` gates `/shiftly/**`, treating `/shiftly/login` as the one public path but still pointing `loginPath` at the shared `/admin/login`). Token changes (`setToken`/`clearToken`) dispatch a custom `admin-auth-change` `window` event so other mounted components (notably the public site's `components/Nav.tsx`, which persists across client-side navigations and shows Login/Logout based on session state) can react without a full reload.

`app/admin/page.tsx` is the launcher — a typed array of `{name, href, description}` app tiles (Shiftly, Pantrly, Ledgerly), linking to each app's top-level route (e.g. `/shiftly`, `/pantrly`, `/ledgerly`). Apps are NOT nested under `app/admin/**` — add a future app as a sibling top-level route, `app/<app-name>/**`, with its own `layout.tsx` wrapping children in `AdminGuard`, then add a tile to the launcher's `APPS` array pointing at it. `app/admin/**` itself is just the launcher and the shared `/admin/login` page, not a namespace apps live under.

Generic Tailwind UI primitives shared by every app — `Button`, `Card`, `Input`/`Label`, `Modal`, `SegmentedControl` — live in `components/admin/ui/` (not under any one app's folder), imported by both Shiftly and Pantrly. `lib/admin/clsx.ts` is the shared `clsx()` helper behind them. An app's own domain components (forms, per-app widgets) stay under `components/<app>/`.

**Shiftly** (`app/shiftly/**`, `components/shiftly/**`, `lib/shiftly/**`): staff attendance/payout tracker. `lib/shiftly/api.ts` builds on the shared `apiRequest`/`adminApi` helpers in `lib/admin/api.ts` rather than duplicating auth/fetch logic. `app/shiftly/dashboard/layout.tsx` is the sidebar/nav chrome for its four pages (log attendance, manage employees, attendance summary, payout summary); auth is already gated once at `app/shiftly/layout.tsx`, so this layout only reads `email`/`isLoading` from context, it doesn't re-check auth itself. `app/shiftly/login/page.tsx` is legacy/unreachable in practice (the site-level guard redirects to `/admin/login` before it would ever render) — kept styled-consistent but not the real entry point.

**Pantrly** (`app/pantrly/**`, `components/pantrly/**`, `lib/pantrly/api.ts`): restaurant inventory tracker. Stock is tracked via manual **start/end-of-day counts** per item (`log-stock` page), not per-order deduction — mirrors Shiftly's attendance login/logout cadence, one row per item+day with nullable `opening_qty`/`closing_qty` (`pantrly_stock_logs`). Suppliers (`items`/`suppliers` pages) are offline contacts, not an ordering integration — a "Record delivery" action on the Items page logs a `pantrly_purchases` row that adds to stock, with an optional `cost_cents` (only costed deliveries flow into Ledgerly's expense summary). Current stock and low-stock flags (`summary` page, `GET /api/pantrly/summary/stock`) are **computed on read**, not cached: latest logged quantity (closing preferred over opening) plus any purchases since that log's date, compared against the item's `par_level`. `app/pantrly/layout.tsx` has no legacy login sub-page (unlike Shiftly's) — there was nothing worth carrying forward from that dead-code pattern.

**Ledgerly** (`app/ledgerly/**`, `components/ledgerly/**`, `lib/ledgerly/api.ts`): restaurant revenue/expenditure tracker. Revenue supports two entry modes side by side on `log-revenue` — a quick end-of-day cash/card/UPI total (`ledgerly_revenue_logs`, one upserted row per day) *and* granular per-sale entries (`ledgerly_sales`, many rows per day). Reporting never double-counts a day logged both ways: `revenue.Repo.RangeRevenue` sums a day's per-sale entries if any exist, otherwise falls back to that day's total — never both. `payments` is one generic ledger (`ledgerly_payments`) for every kind of outgoing payment, distinguished by a `category` field (`payment.ValidCategories`: rent, utilities, supplier_purchase, salary, maintenance, marketing, licenses_fees, transport, equipment, other — keep the frontend's `CATEGORY_OPTIONS`/`CATEGORY_LABELS` in sync if this set changes) plus optional `employee_id`/`supplier_id` links into Shiftly's/Pantrly's own tables (a cross-app FK, consistent with `payout` already composing Shiftly's employee+attendance data directly). The P&L summary (`GET /api/ledgerly/summary/pnl`) computes revenue + `ledgerly_payments` + costed Pantrly purchases (via `pantrly/stock.Repo.ListPurchasesWithCost`) into one profit figure, same "computed on read, never cached" philosophy as Shiftly/Pantrly.

**Role-based access (Accessly)**: every admin has a `role` on the `admins` table — `owner`, `operations`, or `accounting` — managed through Accessly (`/accessly`, see below), not env vars. The role is embedded in the JWT at login (`auth.Claims.Role`) and stashed in request context by `middleware.RequireAuth` (`AdminRoleKey`, alongside the existing `AdminIDKey`/`AdminEmailKey`), so `internal/accessly/access.RequireRole(...)` gates a route group with no extra DB lookup. `cmd/api/main.go` wraps each app's routes accordingly: Shiftly/Pantrly → owner+operations (Shiftly's employee management and payout summary are further narrowed — employees to owner-only, payout to owner+accounting); Ledgerly → owner+accounting, with its P&L summary/Tax Export (and the whole of Menuly/Intel-ly, which sit behind the same `GET /api/ledgerly/access` gate) narrowed further to owner-only; Accessly itself → owner-only. A role change takes effect for that user on their next login (24h JWT), not immediately. On the frontend, `lib/admin/app-access.ts` (`canAccessApp`) plus per-page role checks (e.g. `lib/ledgerly/use-access.ts`'s `useLedgerlyAccess()`, `lib/admin/use-app-role-guard.ts`) hide nav tabs/launcher tiles and show a fallback "not authorized" state for anyone who navigates there directly by URL — the actual enforcement is always server-side.

Per-page browser tab titles are set via `lib/admin/use-page-title.ts` (`usePageTitle(title)`), since client components can't use `generateMetadata`. Money is stored as integer paisa (`*_cents` fields, e.g. `monthly_pay_cents`, `cost_cents`, `amount_cents`) and formatted as INR via `lib/admin/format.ts`'s `formatINR()`.

### Backend (`backend/`, Go, module `attendance-app/costaebella-backend`)

Standard layered structure: `cmd/api/main.go` wires everything and starts a `chi` router. `internal/<domain>/{handler,repo,models}.go` per domain, split into shared infra vs. per-app domains so each app has a clear place to live:
- Shared, used by every app: `auth` (Google Sign-In + JWT, whitelist-gated), `config`, `db`, `middleware` (`RequireAuth`, `CORS`, `Logging`).
- App-specific, nested under `internal/<app>/`: Shiftly's domains live at `internal/shiftly/{employee,attendance,payout,reconcile}`; Pantrly's at `internal/pantrly/{item,supplier,stock}`. A future app follows the same shape rather than sitting flat alongside existing apps' packages.

`internal/db/db.go` embeds and auto-applies `migrations_sql/*.up.sql` on every boot (no separate migrate step — `task db:migrate` is just a no-op alias for discoverability). Migration tracking is by exact filename (`schema_migrations.version`) via a non-recursive `ReadDir`, so `migrations_sql/` stays one flat directory across apps — never move/rename an already-applied file, and never nest new ones in subdirectories; just prefix new files with the app name (e.g. `0008_pantrly_init.up.sql`) for readability.

**Auth**: Google Sign-In only, no passwords. `POST /api/auth/google` exchanges a Google ID token for a JWT, but only if the resulting email exists in the `admins` table — a whitelist, not open signup, shared across every app behind `/admin`. `internal/auth/google.go`'s `VerifyGoogleIDToken` does full verification (RS256 signature against Google's JWKS, issuer, audience, `email_verified`) before anything touches the whitelist. `config.AdminEmail` (from `.env`) is upserted into that table, as an `owner`, on every boot via `SeedWhitelistedEmail` (`internal/auth/auth.go`) — this bootstraps only the very first account; every subsequent user (and role) is managed through Accessly, not env vars. All other routes require `Authorization: Bearer <jwt>` via `RequireAuth`, which stashes the verified email and role in context (`middleware.AdminEmailKey`, `AdminRoleKey`) for role-gated routes (see Accessly below). Every whitelist email in `admins` is compared via `auth.NormalizeEmail` (trim + lowercase) on both insert and lookup, so incidental case/whitespace differences can't silently lock someone out or open a gap.

**Accessly** (`app/accessly/**`, `components/accessly/**`, `lib/accessly/api.ts`, backend `internal/accessly/{user,access}`): user account management — CRUD on the `admins` table plus binding a user's role (owner/operations/accounting), gated owner-only (`accessly.RequireOwner`). A user can't unbind their own role or delete their own account (self-lockout guard) — roles can only be reassigned, not cleared to "no role"; deleting a user is the only way to fully revoke access. See "Role-based access (Accessly)" above for how roles gate every other app.

`JWT_SECRET` has **no fallback default** — `cmd/api/main.go` calls `log.Fatal` at boot if it's empty, since a known/guessable signing secret would let anyone forge an admin token. Always set it to a real random value (`openssl rand -base64 48`) in every environment, including local `.env` — never rely on placeholder text making it to production.

**Routing convention**: app-specific routes are namespaced `/api/<app>/**` (e.g. `/api/shiftly/employees`, `/api/shiftly/attendance/log`, `/api/pantrly/items`, `/api/pantrly/summary/stock`) so apps can't collide with each other's routes. Only `/api/auth/google` sits outside that namespace, since login is shared infra, not app-specific. `frontend/lib/shiftly/api.ts` and `frontend/lib/pantrly/api.ts` call these paths directly — keep both sides in sync if a route changes.

**Pantrly's `internal/pantrly/stock` package** is the one domain worth calling out: it holds both the daily opening/closing count log (`UpsertLog`, mirroring `shiftly/attendance`'s upsert-by-date pattern) and delivery/purchase records, plus `Summary()` — a single SQL query using `LEFT JOIN LATERAL` to compute every item's current stock (latest logged qty + purchases since) and low-stock flag without an N+1 loop. Nothing is cached; it's recomputed on every request, same philosophy as Shiftly's payout being derived from attendance rather than stored.

**Background job**: `internal/shiftly/reconcile` runs every 5 minutes (`go reconcile.Run(...)` in `main.go`) to auto-close attendance logs where an employee forgot to log out, so a missed logout doesn't skew hours-worked/payout math indefinitely.

**Deploy target**: Raspberry Pi (arm64/armv8). `backend/Dockerfile` cross-compiles natively via `--platform=$BUILDPLATFORM` (avoids slow/flaky QEMU for the Go build itself) and produces a static (`CGO_ENABLED=0`) binary onto a `gcr.io/distroless/static-debian12:nonroot` final stage — no shell, no package manager, runs non-root. `.github/workflows/backend-image.yml` builds+pushes `linux/arm64` to `ghcr.io/<owner>/<repo>-backend` on every push to `main` touching `backend/**`, using the built-in `GITHUB_TOKEN`.

## Deploy

Frontend: static export, deployed via Cloudflare Pages' native Git integration (builds on push itself — not handled by GitHub Actions). Backend: GitHub Actions builds the arm64 Docker image on push to `main`; running it on the Pi (pulling the new image, restarting the container) is a separate, manual/external step not automated in this repo.
