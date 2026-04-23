# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Next.js dev server (http://localhost:3000)
npm run build            # prisma generate && next build
npm run lint             # next lint (eslint-config-next)
npm run db:migrate       # prisma migrate dev
npm run db:seed          # tsx prisma/seed.ts — creates superadmin + "taro" demo tenant
npm run stripe:listen    # stripe CLI webhook forwarder → /api/stripe/webhook

# Import a CodeFusion-scraped restaurant (see scraped/index.json for IDs)
npx tsx scripts/import-from-scrape.ts --id <restaurantId>
npx tsx scripts/import-from-scrape.ts --find "sushi california"
npx tsx scripts/import-from-scrape.ts --all --active-only
```

Database is Postgres; `DATABASE_URL` is required. `AUTH_SECRET` is required. The `@/*` path alias maps to the repo root.

## Architecture

### Multi-tenant via subdomain

A single Next.js app serves every restaurant on its own subdomain (`<slug>.localhost:3000` in dev, `<slug>.<ROOT_DOMAIN>` in prod). The whole tenant story flows through three pieces:

1. **`middleware.ts`** reads the `Host` header, runs `slugFromHost` (`lib/tenant/resolve.ts`), and writes the result into the `x-tenant-slug` request header. Its matcher **excludes** `_next`, `favicon.ico`, `uploads/` (local-fallback image serving), `api/stripe/webhook` (raw body must stay intact for signature verification), and `api/auth/*`.
2. **`lib/tenant/resolve.ts`** — `getTenantFromHeaders()` looks up the `Restaurant` by slug. Server components call this; `requireTenant()` throws if no tenant was resolved.
3. **App Router route groups** — `app/(tenant)/...` is the customer storefront (menu/cart/checkout/confirmation/account), `app/(admin)/admin/...` is the per-tenant admin dashboard, `app/platform/...` is the superadmin console (tenants, users, creation flow), and `app/login` / `app/signup` / `app/reset-password` are shared across all hosts.

The **session cookie is host-scoped**, so tenant owners must sign in on their subdomain and superadmins on the root domain. `NEXT_PUBLIC_ROOT_DOMAIN` defaults to `localhost:3000`.

### Auth model (`lib/auth/require.ts`)

Auth.js v5 (beta) with the Credentials provider + bcrypt + JWT sessions (see `auth.ts`). Three role helpers:

- `requireUser` — any signed-in user
- `requireTenantAdmin(restaurantId)` — superadmin **or** a `RestaurantMember` of that tenant
- `requireSuperAdmin` — `User.isSuperAdmin = true` only

API routes use the pattern `const res = await requireX(); if (res instanceof NextResponse) return res;` — the helpers return either an `AuthedUser` or a 401/403 `NextResponse`. Server components use `getCurrentUser()` / `canAdminTenant()` which return plain values.

### Data model (`prisma/schema.prisma`)

`Brand` (optional) → `Restaurant` (tenant root; `slug` is unique and drives the subdomain) → `Menu` → `MenuCategory` (`order`) → `MenuItem` (`sortOrder`, `isAvailable`, `tags: string[]`). Ordering/checkout lives under `Order` → `OrderItem` + `Payment` (1:1, holds `stripePaymentIntentId` + `status`). `User` ↔ `Restaurant` joins through `RestaurantMember` (`@@unique([userId, restaurantId])`).

Tenant-curated tags on `MenuItem` are known values `favorite | spicy | vegan` (see `lib/menu/tags.ts`). Prices are **integer cents**. `Restaurant.source` and `MenuItem.source` hold the full raw scraped payload for forward-compatibility — treat these as a reference, not a source of truth. `Restaurant` also carries operational/policy fields (`minOrder`, `waitTimeMinutes`, `tipValues`, `bagFee`, `businessHours`, `inactive`, `orderOpen`) that are captured on import but may only be partially wired into UI.

### Stripe payments

`POST /api/create-payment-intent` creates the `Order` + `OrderItem`s and a Stripe `PaymentIntent` in one transaction. If the tenant has `Restaurant.stripeAccountId` set, the PaymentIntent is created on that connected account (Stripe Connect); otherwise payments go direct to the platform. `POST /api/stripe/webhook` verifies the signature (needs `STRIPE_WEBHOOK_SECRET`) and flips `Order.status` between `pending` / `paid` / `failed`. **This route is excluded from middleware** so the raw body reaches the handler unmodified.

### Image uploads (`app/api/upload`, `components/image-upload.tsx`)

`POST /api/upload` requires a signed-in user and accepts ≤5 MB `image/{png,jpeg,webp,gif,svg+xml}`. If `BLOB_READ_WRITE_TOKEN` is set it uploads to Vercel Blob and returns a CDN URL; otherwise it falls back to writing under `public/uploads/<prefix>/…` and returning a relative URL. **The filesystem fallback is dev-only** — Vercel's runtime is read-only, so Blob must be configured before any deploy.

### Menu editor (`/admin/menu`)

All writes go through `/api/admin/menu/categories` and `/api/admin/menu/items` (POST + `/[id]` PATCH/DELETE), all gated by `requireTenantAdmin`. Reordering is done by updating `MenuCategory.order` / `MenuItem.sortOrder`. `lib/tenant/ensure-menu.ts` lazily creates the default "Main" menu when a tenant first opens the editor.

### Scraped data → tenant import

`scraped/` contains the CodeFusion archive (431 restaurants + images; `index.json` is the entry point). `scripts/import-from-scrape.ts` is idempotent per restaurant: it **replaces** all Menus under the target `Restaurant`, picks the first active location and its "default" menu by default, and carries POS IDs / tax rates / modifier group refs into `MenuItem.source`. When traversing the scraped data, walk `category.productOrder[]` — that array is authoritative for ordering and membership; `product.categoryId` is not reliable, and `active`/`activeAfter` must be checked to avoid importing hidden products.

## Conventions

- Money is always integer cents in the DB and in API payloads.
- API route handlers return `NextResponse.json(...)` directly; auth helpers return a `NextResponse` on failure that should be returned as-is.
- Server components read the tenant with `getTenantFromHeaders()` / `requireTenant()`; never parse the `Host` header manually elsewhere.
- When adding routes, remember the middleware matcher — anything that needs the raw body (webhooks) or a non-tenant host must be added to the exclusion list.
