# sushi-online

Multi-tenant, white-label restaurant ordering platform. Each restaurant is served on its own subdomain with its own theme, menu, orders, and Stripe account.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn-style primitives (hand-rolled in `components/ui`)
- Prisma + PostgreSQL
- **Auth.js (NextAuth v5) — credentials provider + bcrypt**
- **Vercel Blob for image uploads (with local filesystem fallback for dev)**
- Stripe (PaymentIntents + Connect)
- Zustand for the cart (persisted to localStorage)

## Project layout

```
app/
  (tenant)/            customer storefront (menu, cart, checkout, confirmation)
  (admin)/admin/       admin dashboard (orders, menu, settings) — session-gated
  login/               shared login page (works on any subdomain)
  api/
    auth/[...nextauth]/         Auth.js handler
    upload/                     POST image → Vercel Blob or /public/uploads
    create-payment-intent/      POST — creates Order + Stripe PaymentIntent
    stripe/webhook/             POST — Stripe → paid/failed status updates
    admin/create-restaurant/    POST (superadmin) + PATCH (tenant admin)
    admin/members/              POST (superadmin) create user + membership
    admin/menu/categories/      POST + /[id] PATCH/DELETE (rename, reorder)
    admin/menu/items/           POST + /[id] PATCH/DELETE (edit, reorder, move)
    admin/orders/[id]/          PATCH order status
    admin/export/               GET tenant's orders as CSV
auth.ts                Auth.js config (credentials + JWT session)
lib/
  db/prisma.ts           Prisma client singleton
  tenant/resolve.ts      slug extraction + cached tenant lookup
  tenant/ensure-menu.ts  lazy-create the default "Main" menu for a tenant
  stripe/client.ts       Stripe SDK client
  stores/cart.ts         Zustand cart store
  auth/require.ts        session helpers (requireUser / requireTenantAdmin / requireSuperAdmin)
components/
  ui/                    Button, Input, Card primitives
  image-upload.tsx       drop-in uploader with preview + URL fallback
middleware.ts            sets x-tenant-slug header from subdomain
prisma/
  schema.prisma          full schema (Restaurant, Menu, Order, Payment, User, RestaurantMember)
  seed.ts                creates a superadmin + "taro" demo tenant
```

## Setup

1. **Install Node 20+** (this machine didn't have it at scaffold time) and run:

   ```bash
   cd sushi-online
   npm install
   ```

2. **Start Postgres** and copy `.env.example` to `.env.local`, filling in values.

   Generate an auth secret:
   ```bash
   openssl rand -base64 32
   ```

3. **Run the migration and seed a demo tenant + superadmin:**

   ```bash
   npx prisma migrate dev --name init
   npm run db:seed
   ```

   The seed prints the superadmin email/password (defaults from env vars `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD`). Change these before running.

4. **Start the dev server:**

   ```bash
   npm run dev
   ```

5. Visit:
   - `http://localhost:3000` — index with a list of tenants
   - `http://taro.localhost:3000/menu` — seeded storefront
   - `http://taro.localhost:3000/admin/orders` — admin (redirects to `/login`)

   Modern browsers resolve `*.localhost` to `127.0.0.1` automatically. If yours doesn't, add `127.0.0.1 taro.localhost` to `/etc/hosts`.

## Auth model

Three roles, enforced by `lib/auth/require.ts`:

| Helper              | Grants access to                                 |
| ------------------- | ------------------------------------------------ |
| `requireUser`       | any signed-in user                               |
| `requireTenantAdmin`| superadmin **or** `RestaurantMember` of that tenant |
| `requireSuperAdmin` | only users with `isSuperAdmin = true`            |

Sign-in flow: everyone uses `/login` (same page served on root and on any tenant subdomain). The session cookie is scoped to whatever host the user signed in on — so **tenant owners should sign in at their subdomain** (e.g. `taro.localhost:3000/login`) and superadmins at the root domain.

To create another tenant admin from the superadmin account:

```bash
curl -X POST http://localhost:3000/api/admin/members \
  -H "Cookie: <paste your session cookie>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "chef@taro.example",
    "password": "hunter22XX",
    "restaurantId": "<taro's id>"
  }'
```

## Image uploads

`POST /api/upload` (multipart/form-data, field `file`, optional `prefix`) returns `{ url }`.

- If `BLOB_READ_WRITE_TOKEN` is set → uploads go to [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) and return a CDN URL.
- If not → falls back to writing under `/public/uploads/<prefix>/…` and returns a relative URL.

**The filesystem fallback is dev-only** — Vercel's production runtime is read-only, so you **must** configure Blob before deploying. Create a Blob store in your Vercel project and add the generated token to `BLOB_READ_WRITE_TOKEN`.

Uploads are allowed for any signed-in user; only 5 MB max, `image/{png,jpeg,webp,gif,svg+xml}`.

The `<ImageUpload>` component (`components/image-upload.tsx`) is used for:
- Menu item images
- Restaurant logo (square)
- Restaurant banner (wide)

Each also accepts a pasted URL, so you can skip the upload if you already have a CDN.

## Menu editor

`/admin/menu` supports:

- **Categories**: create, rename (click the name), reorder (▲ ▼), delete (cascades to items)
- **Items**: create (inside a category), edit (name/description/price/image/category/availability), reorder within category, toggle visibility, delete, move between categories
- **Images** via Vercel Blob (or paste URL)

All writes go through `/api/admin/menu/*` and require `requireTenantAdmin`.

## Stripe

1. Add `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to `.env.local`.
2. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then forward webhooks:

   ```bash
   npm run stripe:listen
   ```

   Copy the `whsec_...` secret into `.env.local` as `STRIPE_WEBHOOK_SECRET`.

3. Test card `4242 4242 4242 4242` with any future expiry and CVC.

**Connect**: If a restaurant has `stripeAccountId` set, payment intents for that tenant are created on its connected account. Leave blank for direct-to-platform payments.

## Creating a restaurant via API

Sign in as a superadmin first (the API reads your session cookie):

```bash
# Get cookie by logging in through /login, or use your browser devtools to copy it.
curl -X POST http://localhost:3000/api/admin/create-restaurant \
  -H "Cookie: authjs.session-token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Blue Fin",
    "slug": "bluefin",
    "primaryColor": "#1e40af",
    "currency": "CAD",
    "ownerEmail": "chef@bluefin.example",
    "menu": {
      "categories": [
        { "name": "Rolls", "items": [
          { "name": "Rainbow Roll", "price": 1850 }
        ]}
      ]
    }
  }'
```

If `ownerEmail` matches an existing user, they're auto-added as a `RestaurantMember`. Response includes the tenant URL, e.g. `http://bluefin.localhost:3000/menu`.

## Deploying to Vercel

- Set all env vars from `.env.example` in the Vercel project (don't forget `AUTH_SECRET` and `BLOB_READ_WRITE_TOKEN`).
- Add a wildcard domain (e.g. `*.sushi-online.com`) pointed at the Vercel project.
- Set `NEXT_PUBLIC_ROOT_DOMAIN=sushi-online.com`.
- Point your Stripe webhook at `https://sushi-online.com/api/stripe/webhook` and update `STRIPE_WEBHOOK_SECRET`.

## Testing the order flow locally

1. `npm run db:seed` — creates superadmin + `taro`
2. Open `http://taro.localhost:3000/menu`, add items, go to `/checkout`
3. In another terminal, `npm run stripe:listen`
4. Complete payment with `4242 4242 4242 4242`
5. Log in at `http://taro.localhost:3000/login`, go to `/admin/orders` — the order should appear; the webhook flips it from `pending` → `paid`
