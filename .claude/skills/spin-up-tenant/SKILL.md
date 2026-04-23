---
name: spin-up-tenant
description: Create, restore, or re-import a tenant (restaurant location) in sushi-online from the scraped CodeFusion archive. Use when the user asks to "spin up", "create", "add", "import", or "restore" a tenant, or wants to populate a new subdomain with real scraped menu data.
---

# Spin up a tenant from scraped data

`sushi-online` is a multi-tenant restaurant ordering platform. Each tenant is one **physical restaurant location** served on its own subdomain (`<slug>.localhost:3000` in dev, `<slug>.<ROOT_DOMAIN>` in prod). We have ~431 restaurants' worth of real menu data scraped from a Firestore-backed ordering platform called CodeFusion, living in `scraped/` at the project root.

This skill is the shortest path to: "I want a new tenant showing up on a specific subdomain, populated with real data."

## TL;DR

```bash
# Find the restaurant and its locations
npx tsx scripts/import-from-scrape.ts --find "sushi california"

# Look inside the JSON to pick the right location id
python3 -c "import json; d=json.load(open('scraped/restaurants/<id>.json')); \
  print([(l['_id'], l.get('locationName'), l.get('address')) for l in d['locations']])"

# Import one specific location onto a clean slug
npx tsx scripts/import-from-scrape.ts \
  --id <firestore-restaurant-id> \
  --location <firestore-location-id> \
  --slug my-custom-slug

# Visit:  http://<my-custom-slug>.localhost:3000
```

The importer is **idempotent** by location id — re-running upserts the same tenant row and wipes/re-creates its menus.

## When to use `--id` vs `--all`

- **`--id <restaurantId>`** — import every active location under one CodeFusion Restaurant doc (typically one, sometimes several locations sharing a menu). This is what you want for "spin up one restaurant."
- **`--id <rid> --location <lid>`** — import exactly one location. Use this when a Restaurant doc lists multiple locations (e.g. Sushi California has Lougheed / Surrey / Langley / Coquitlam Center / Broadway / Downtown) and you want to pin a specific one.
- **`--id <rid> --location <lid> --slug my-slug`** — same as above but override the auto-generated slug. Useful for restoring a historical slug like `sushi-cal-lougheed`.
- **`--all --active-only`** — full reset, used once at project setup. Deletes all previously-imported (Restaurant-doc-keyed-and-location-keyed) scraped rows, then imports every active location. **Don't use for a single tenant** — it's destructive platform-wide.
- **`--dry-run`** — works with any mode. Prints what would happen without writing.

## What gets populated

The importer (`scripts/import-from-scrape.ts`) upserts a tenant keyed on the location's Firestore id (`loc._id`). On every run it:

1. **Upserts a `Brand`** row keyed on `slugify(cleanRestaurantName(r.name))`. "Sushi California 4" → brand `sushi-california`. All locations of the same brand link here via `Restaurant.brandId`.
2. **Upserts a `Restaurant`** row with:
   - `name` — brand-level (trailing "N" like "Sushi California 4" is stripped to "Sushi California")
   - `locationName` — cleaned (`"1. Lougheed Location"` → `"Lougheed"`)
   - `slug` — `<brand>-<location>` (e.g. `sushi-california-lougheed`) unless `--slug` overrides
   - `logoUrl`, `bannerUrl` — from scrape images
   - `address`, `phone` (formatted), `googleMapsUrl`, `landingUrl`
   - `businessHours` — JSON array of `{day: 0–6, open: "HH:mm", close: "HH:mm"}` converted from CodeFusion's epoch-ms format in America/Vancouver TZ (change `CF_RESTAURANT_TZ` env var for other regions)
   - `welcomeMessageTitle`, `welcomeMessageBody` — surfaced as a notice banner on the menu page
   - `socials` — auto-populated from the pre-built cache at `scraped/socials.json` keyed by CodeFusion Restaurant `_id`. The cache was built by `scripts/scrape-socials.ts --build-cache` scraping each unique `landingUrl` once. If the cache has no entry (or an empty entry) for this tenant, `socials` is left null. Only ~11% of scraped landing pages expose socials — most are static brochures.
   - `minOrder` (cents), `waitTimeMinutes`, `tipValues`, `bagFee` — captured for checkout
   - `externalStripeAccountId` — the source platform's Connect account ID, **reference-only**, never used for charges (see Stripe model below)
   - `source` JSON — the entire scraped blob for this location, including modifier groups and POS IDs we haven't promoted to first-class columns yet
   - `inactive`, `orderOpen` booleans
3. **Replaces the tenant's menu entirely**: `menu.deleteMany({ restaurantId })` then recreates categories + items from the location's menu doc. Category order follows CodeFusion's priority: `menu9 → menu8 → … → menu1 → default`.
4. **Skips bad products**: `isProductImportable` drops entries with non-finite prices (some scraped rows have `price: "NaN"`).
5. **Images**: products use `p.imageUrl` from the scrape verbatim — no fallback. Image URLs stay remote (CodeFusion's Firebase / Cloudfront CDN); `next.config.mjs` allows all HTTPS hosts. **Coverage varies wildly by tenant and that's fine**: some menus are fully imaged (e.g. Hanaya 230/230, Kokoro Mazesoba 100%), some are partial (Mapo BBQ 66/95), and some have zero product-level images at all (Sushi U Burnaby 0/239 — their CodeFusion menu stores images only at the category level, and category images are **not** fanned out to items because that would misrepresent what each item actually looks like). The menu UI handles missing images cleanly by dropping the image column and moving the "+" button inline with the price. If a tenant ends up with no images, **don't "fix" it by applying category images to products** — that was tried once and produced misleading menus where every item in a category had the same photo.
6. **Modifiers**: materialized onto `MenuItem.modifiers` as `[{ id, name, required, maxSelect, choices: [{ id, name, price }] }]`. Resolved from `p.modifiers[]` (group IDs on each product) against the menu's modifier registry. Choices with non-finite prices or `activeAfter > now` are dropped; groups that end up with zero valid choices are dropped entirely. CodeFusion choices often reuse `posId` across the same group (e.g. all protein options share posId 213), so the importer synthesizes stable unique ids as `<groupId>:<index>`. Only items with actually-present modifier groups end up with this field populated — plain items leave it null. Most menus only use modifiers on a handful of items (e.g. Isshin Sushi: 8 of 342 items).
7. **Per-item source** saved on `MenuItem.source` — `posId`, `activeAfter`, the raw `modifiers` ID list, etc. `taxRate` is promoted to a first-class column.

## Product decisions you should know

These are conventions the codebase already follows — stick to them unless the user asks otherwise.

### Routing and URLs
- `/` on a tenant subdomain → 307 redirect to `/menu/most-liked`
- `/menu` → 307 redirect to `/menu/most-liked` (old URL, kept alive)
- `/menu/[categoryId]` — **single long-scroll page** rendering every category's items. The URL segment is just a deep link; `ScrollToSection` client component scrolls the matching section into view on mount, and `IntersectionObserver` + `history.replaceState` keeps the URL in sync as the user scrolls. Clicking a sidebar/chip entry is a smooth scroll, **not** a navigation.
- `/cart` — fallback page; primary cart UI is a **dropdown popover** from the header cart icon (anchored below, click-outside/Escape to dismiss). `/cart` shows the same data via `CartView` for direct URL access.
- `/checkout`, `/confirmation`, `/account` — no banner / welcome / tenant-info chrome; only the header.
- `/signup`, `/login`, `/reset-password/[token]` — public auth pages, no tenant chrome at all.

### Menu UX
- **Sorting within each section**: favorites first (`tag === "favorite"`), then #1/#2/#3 Most Liked (by `fake-stats.rankByScore`), then the rest in their original `sortOrder, name` order. `Array.sort` is stable so non-ranked items keep their original position.
- **Most Liked** is a synthetic first section (`MOST_LIKED_SLUG = "most-liked"`) picking top-8 by a deterministic placeholder score (`lib/fake-stats.ts`). Replace with real popularity when order data is available.
- **Tags** (`lib/menu/tags.ts`): `favorite`, `spicy`, `vegan`. Stored as `MenuItem.tags String[]`. Favorite gets a green "⭐ Favorite" pill and floats to top; Spicy gets a red flame pill; Vegan gets an emerald leaf pill. Adding a new tag = update `ALL_MENU_TAGS` + `TAG_INFO` + the zod enum in both menu item APIs; no migration.
- **Item cards**: text on left, 128px mobile / 160px desktop square image on right. When no image, the image column is omitted and the "+" button moves inline next to the price. **Don't render gray placeholders for missing images.**
- **Item click → dialog**. Both clicking anywhere on a card and clicking the "+" button open `ItemDialog` (`app/(tenant)/menu/item-dialog.tsx`). The dialog shows the image (if any) at the top, name + description, then a list of modifier groups rendered as **radio buttons when `maxSelect === 1`** and **checkboxes otherwise** (`maxSelect > 1` caps the allowed count; `0` = unlimited). The footer has an "Add to cart" button with the live total (base + chosen deltas). The button is disabled until every `required` group has ≥1 pick. There is no more direct-add "+" animation — adding happens inside the dialog, which closes on add.
- **Cart line key = item id + sorted choice ids** (`computeLineId` in `lib/stores/cart.ts`). Two "California Rolls" with the same modifiers stack; different modifier selections are separate lines. Cart state persists in localStorage under `sushi-online-cart` with `version: 2` — the version bump dropped the pre-modifier shape.
- **Modifier selections flow through checkout** as `{ menuItemId, quantity, modifiers: [{ groupId, choices: [{ choiceId, name, price }] }] }`. `POST /api/create-payment-intent` **re-validates every selection server-side** against the stored `MenuItem.modifiers` (unknown group/choice → 400, over `maxSelect` → 400, missing a `required` group → 400), recomputes unit price from server-side prices only (no client-trusted prices), and persists a snapshot on `OrderItem.modifiers` so the confirmation page + admin can render the exact selections even if the menu changes later.

### Layout / chrome
- Sticky header with logo (44px mobile / 56px desktop), restaurant name (`text-lg md:text-2xl`), Account/Sign-in link, CartBadge (popover trigger).
- Header text shows `displayTenantName(tenant)` — if `locationName` is set, it renders as `"{name} - {locationName}"` (e.g. `Sushi California - Lougheed`), otherwise just the name.
- Banner image: `tenantBannerUrl(tenant)` — returns `tenant.bannerUrl` if set, otherwise a deterministic loremflickr food/restaurant image seeded by slug. Fixed `h-32 md:h-56`, `object-cover`, `rounded-lg`, constrained to `max-w-6xl`.
- `WelcomeBanner` — thin amber notice bar between banner and `TenantInfo`, rendered only if `welcomeMessageTitle` or `welcomeMessageBody` is set.
- `TenantInfo` — on mobile it collapses to a single tappable row (address + open/closed pill + chevron); tapping expands to the full grid (address + phone + weekly hours + Google Maps embed iframe). Desktop is always the full grid. The collapsed and expanded states are inside one bordered container; the summary row hides entirely when expanded and a chevron-up in the corner collapses back.
- **All content** is `max-w-6xl` inside `app/(tenant)/layout.tsx`.

### Auth model (`lib/auth/require.ts`)
- NextAuth v5 credentials provider, JWT session, bcrypt-hashed passwords.
- Three gates:
  - `requireUser` — any signed-in user
  - `requireTenantAdmin(restaurantId)` — superadmin **or** `RestaurantMember` of that tenant
  - `requireSuperAdmin` — only `User.isSuperAdmin`
- Customers sign up at `/signup`, which creates a non-admin User and auto-signs them in.
- Session cookie is scoped per-host. Tenant owners log in on their tenant subdomain; superadmins on the root domain.
- Password reset: `/api/account/request-password-reset` (logged-in user) generates a sha256-hashed token with 1-hour expiry, calls `sendEmail()` from `lib/email/send.ts` (dev stub logs to server console; prod swap-in for Resend/SendGrid). Token lives in `PasswordResetToken` table, single-use. User sets new password at `/reset-password/[token]`.

### Stripe model
- **Saved cards** only work for **direct-charge** tenants (`Restaurant.stripeAccountId` is null). Store `stripeCustomerId` on User; attach to PaymentIntent and `setup_future_usage: off_session` so PaymentElement surfaces saved cards automatically.
- **Stripe Connect** (`Restaurant.stripeAccountId` set) routes charges to the connected account; saved-card re-use across accounts is out of scope. `externalStripeAccountId` from the scrape is **reference-only** — never used by payment code.
- Dev `.env.local` typically has placeholder keys. The Payment Methods section on `/account` renders regardless; if the API returns `Invalid API Key`-style errors, the component surfaces a friendly "Saved cards unavailable until Stripe is configured" line instead of scary raw errors.

### Favicon
- `app/(tenant)/layout.tsx` sets per-tenant `icons` in metadata (returned from `generateMetadata`). All three rel types emitted: `icon`, `shortcut icon`, `apple-touch-icon`. If `tenant.logoUrl` is set, it's used directly as the favicon URL; otherwise `faviconHref()` returns an inline SVG data URL containing the 🍣 sushi emoji at 88px inside a 100×100 viewBox.

## UI spec reference (the specific sizes and classes)

The codebase uses Tailwind classes directly (no custom design tokens beyond the CSS variables below). This section is the exhaustive lookup for "how big is X" / "what colour is Y" / "what does the sticky layout look like."

### CSS variables (set on the `(tenant)/layout.tsx` root div)
- `--primary` = `tenant.primaryColor` or `#111111`
- `--primary-foreground` = `#ffffff`
- `--secondary` = `tenant.secondaryColor` or `#f4f4f5`
- `--secondary-foreground` = `#111111`
- Other vars in `app/globals.css`: `--background #ffffff`, `--foreground #0a0a0a`, `--muted #f4f4f5`, `--muted-foreground #71717a`, `--border #e4e4e7`

### Layout widths
- Content container everywhere: `mx-auto max-w-6xl px-4 md:px-6` (1152px max, 16/24px side padding)
- Auth/marketing pages: `max-w-sm` or `max-w-md` centered
- Cart popover: `max-w-sm w-[calc(100vw-2rem)]`
- Item dialog in admin: `max-w-lg`
- Account page grid: `grid grid-cols-1 md:grid-cols-2 md:gap-10`

### Header
- `sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur`
- Padding `py-3 md:py-5`
- Logo: `h-11 w-11 rounded object-cover md:h-14 md:w-14` (44→56px)
- Restaurant name: `truncate text-lg font-semibold md:text-2xl`
- Account/Sign-in + CartBadge on the right with `gap-4`

### Banner
- Wrapper: same `max-w-6xl px-4 md:px-6`
- Image: `mt-4 md:mt-6 h-32 md:h-56 w-full rounded-lg object-cover` (128→224px tall)
- Source: `tenantBannerUrl(tenant)` — loremflickr fallback if `bannerUrl` null

### WelcomeBanner (`app/(tenant)/welcome-banner.tsx`)
- `mt-4 md:mt-6`
- `rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900`
- Info icon (lucide `Info`) at `h-4 w-4` on the left
- Title `font-medium`, body `text-amber-800` one line below

### TenantInfo (`app/(tenant)/tenant-info.tsx`)
- Wrapper: `mt-6 md:mt-8 overflow-hidden rounded-lg border border-border bg-background`
- **Mobile collapsed**: `button` with `flex w-full items-center justify-between gap-3 p-3`; icon `MapPin` 4×4; status pill `rounded px-1.5 py-0.5 text-[11px]`; `ChevronDown` 4×4 (no rotation — hidden entirely when expanded)
- **Expanded body** (always on desktop, toggled on mobile): `relative grid-cols-1 gap-4 p-4 md:grid md:grid-cols-[1fr_1.1fr] md:gap-6 md:p-5`
- **Mobile collapse affordance**: `absolute right-2 top-2 rounded-full p-1 md:hidden` with `ChevronUp` 4×4
- Map iframe: `min-h-[200px] md:min-h-[260px] rounded-md border border-border`, `src={https://www.google.com/maps?q=<address>&output=embed}` (no API key needed)
- Hours list: `grid grid-cols-[80px_1fr]` per day; today is `text-foreground`, other days `text-muted-foreground`
- Status pill: `bg-green-50 text-green-700` when open, `bg-muted text-muted-foreground` when closed
- **Social links row** (`SocialLinks` inline in `tenant-info.tsx`): rendered between the phone and hours blocks in the left column, only when `Restaurant.socials` has ≥1 entry. Icons are `h-8 w-8 rounded-full border border-border` (lucide `Instagram`/`Facebook`/`Twitter`/`Youtube`/`Linkedin`, plus an inline SVG for TikTok). Order: instagram, facebook, twitter, tiktok, youtube, linkedin. Hover: `hover:border-primary/40 hover:text-foreground`. Each is `<a target="_blank" rel="noopener noreferrer">` with `aria-label={SOCIAL_LABEL[platform]}`.

### Category nav (`app/(tenant)/menu/category-nav.tsx`)
- **Mobile chips** (`CategoryChipsMobile`): `sticky top-14 z-10 -mx-4 border-b border-border bg-background/95 backdrop-blur md:hidden`; chips are `whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider`; active has `border-foreground text-foreground`, inactive `border-transparent text-muted-foreground`
- Edge scroll indicators: circular chevron buttons in `h-8 w-8 rounded-full border border-border bg-background shadow-md` over a `bg-gradient-to-r from-background` fade; fade in/out via opacity
- **Desktop sidebar** (`CategorySidebar`): 220px column (`md:grid md:grid-cols-[220px_1fr] md:gap-8` in the menu layout), `sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2`
- Sidebar links: `flex items-center justify-between rounded-md px-3 py-2 text-sm`; active `bg-primary font-medium text-primary-foreground`, inactive `hover:bg-muted`; count on the right `text-xs tabular-nums`
- Scroll-spy: IntersectionObserver with `rootMargin: "-25% 0px -60% 0px"`, updates active via `history.replaceState`
- Click handler uses `el.scrollIntoView({ behavior: "smooth", block: "start" })`

### Menu sections and cards (`app/(tenant)/menu/[categoryId]/page.tsx`)
- Section spacing: `space-y-12 md:space-y-16`; each `<section>` has `scroll-mt-28 md:scroll-mt-24` so the sticky header doesn't cover the heading
- Section heading: `text-2xl font-bold tracking-tight`; subtitle `mt-1 text-sm text-muted-foreground`
- Item grid: `mt-4 md:mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4`
- Item card: `flex items-stretch overflow-hidden rounded-lg border border-border bg-background transition-colors hover:border-primary/40`
- Item text column: `flex min-w-0 flex-1 flex-col p-4`; title `text-sm font-bold uppercase tracking-wide`; description `mt-2 line-clamp-3 text-sm text-muted-foreground`; price row at bottom `mt-auto flex items-center justify-between pt-3 text-sm`
- Item image column: `h-32 w-32 md:h-40 md:w-40 object-cover` (128→160px square), `loading="lazy"`
- "+" button (icon variant): `flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background shadow-md`; absolute `bottom-2 right-2` on image cards, inline in price row on image-less cards; animated `scale-110 border-green-600 bg-green-600 text-white` for 900ms on click with `Check` icon

### Badges
- Badges are: `inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium` plus colour classes from `TAG_INFO`
- **#N Most liked** (no favorite tag): `bg-green-50 text-green-700 border-green-200`
- **Favorite** (`⭐`): `bg-green-50 text-green-700 border-green-200`
- **Spicy** (`🔥`): `bg-red-50 text-red-700 border-red-200`
- **Vegan** (`🌿`): `bg-emerald-50 text-emerald-700 border-emerald-200`
- Precedence: if both favorite and ranked, render only the Favorite pill (not the #N Most liked)

### Cart popover (`app/(tenant)/cart-badge.tsx`)
- Trigger button: `ShoppingCart` icon 5×5 plus count; `aria-expanded` reflects state
- Popover: `absolute right-0 top-full z-30 mt-2 w-[calc(100vw-2rem)] max-w-sm origin-top-right rounded-lg border border-border bg-background shadow-xl`, 150ms `scale-95→scale-100 opacity-0→opacity-100` enter animation
- Close via: outside-click, Escape, X button, Checkout link (which `onClick={() => setOpen(false)}` before navigating)
- Items list: `max-h-[min(60vh,360px)] overflow-y-auto`
- Item controls: `h-7 w-7` icon buttons (– qty +) plus `h-7 w-7` ghost X for remove
- Footer: sticky bottom-of-popover; shows min-order warning (amber) + subtotal + Checkout button; button disabled when empty or under min
- Min-order warning: `rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900`

### Account page (`app/(tenant)/account/page.tsx`)
- Two-column grid on md+, stacked below
- **Left column** (Personal info + Payment methods):
  - Name input with Save button inline (`flex items-center gap-2`). Save disabled until name is dirty.
  - Email input disabled
  - "Change password" button → posts to `/api/account/request-password-reset`; disabled after sending; shows green confirmation text below: "Check <email> for a reset link (expires in 1 hour)."
  - Sign-out button on the right
  - Payment methods section renders always. When Stripe isn't configured the list is empty and a friendly message appears: "Saved cards are unavailable until Stripe is configured on this tenant."
  - Saved card rows: `CreditCard` icon, "Visa •••• 4242", expiry `MM/YYYY`, "Set default" text button + trash icon on hover
  - "Add card" opens a modal with Stripe Elements `PaymentElement` (layout: "tabs"), using a SetupIntent from `POST /api/account/payment-methods`
- **Right column**: Previous Orders list. Order cards show `Order #<last 8 chars>` + timestamp + status pill + total + item count. Status pill colours: paid/completed/ready → green, failed/cancelled → red, everything else → muted

### Admin menu editor (`app/(admin)/admin/menu/menu-editor.tsx`)
- Category cards: `Card` component from `components/ui/card.tsx` with ↑/↓ reorder arrows and a trash icon
- Inline category rename on click (the name becomes an `Input` + Save/Cancel)
- Item rows: `h-12 w-12` thumbnail, name + price + optional description, ↑/↓ to reorder, Hide/Show, Edit (pencil), Delete (trash)
- **Tag pills under each row**: clickable to toggle, colours from `TAG_INFO`; inactive state is `border-border bg-background text-muted-foreground`
- Item dialog fields: Name, Description, Price (cents), Category selector, Available checkbox, Tags pill row, Image upload

### Components (`components/ui/`)
- Hand-rolled shadcn-style primitives (no external `@shadcn/ui` package). Variants via `class-variance-authority`.
- `Button` variants: `default`, `outline`, `ghost`, `destructive`; sizes `default` (h-10), `sm` (h-9), `lg` (h-11), `icon` (h-10 w-10). Default = `bg-primary text-primary-foreground hover:opacity-90`.
- `Input`: `h-10 rounded-md border border-border bg-background px-3 py-2 text-sm`
- `Card` / `CardHeader` / `CardTitle` / `CardContent`: rounded-lg + border + shadow-sm
- `ImageUpload` (`components/image-upload.tsx`): file picker + URL-paste fallback; uploads to `/api/upload` which writes to Vercel Blob if `BLOB_READ_WRITE_TOKEN` is set, otherwise falls back to `/public/uploads` (dev only)

### Scroll-margin offsets (why sections don't hide under the sticky bar)
- Desktop: sticky header ≈96px → sections use `md:scroll-mt-24` (96px)
- Mobile: sticky header (~56px) + sticky chips (~44px) ≈100px → sections use `scroll-mt-28` (112px)

## Step-by-step: new tenant from scraped data

1. **Find the restaurant**
   ```bash
   npx tsx scripts/import-from-scrape.ts --find "<name-substring>"
   ```
   Returns Firestore Restaurant IDs + product counts. Take note of the ID you want.

2. **Inspect its locations** (optional but recommended when you suspect multi-location)
   ```bash
   python3 -c "import json; d=json.load(open('scraped/restaurants/<rid>.json')); \
     print('LOCATIONS:'); \
     [print(f\"  {l['_id']}  name={l.get('locationName')!r:40}  addr={l.get('address')!r}  inactive={l.get('inactive')}\") for l in d['locations']]"
   ```
   Each active location becomes a separate tenant if you run `--id` without `--location`. Use `--location` to pin one.

3. **Optional dry-run**
   ```bash
   npx tsx scripts/import-from-scrape.ts --id <rid> --location <lid> --slug <slug> --dry-run
   ```
   Shows `DRY … → /<slug> : N cats, M items` with no writes.

4. **Import**
   ```bash
   npx tsx scripts/import-from-scrape.ts --id <rid> --location <lid> --slug <slug>
   ```

5. **Restart dev server** if the Prisma client schema has changed since last start. Otherwise Next.js caches the old client and tenant queries fail with "Unknown argument" errors:
   ```bash
   lsof -ti :3000 | xargs -r kill -9; pkill -9 -f next; rm -rf .next; npm run dev > /tmp/sushi-dev.log 2>&1 &
   ```

6. **Socials are auto-populated** from `scraped/socials.json` during import — no separate step needed. That cache is built once with `npx tsx scripts/scrape-socials.ts --build-cache`; re-run when you want to refresh or after adding new scraped restaurants. For a one-off refresh on an already-imported tenant, use `--slug`, which does a fresh fetch and writes directly to the DB (bypasses the cache):
   ```bash
   npx tsx scripts/scrape-socials.ts --slug <slug> --dry-run  # see what it would find
   npx tsx scripts/scrape-socials.ts --slug <slug>             # write
   npx tsx scripts/scrape-socials.ts --build-cache             # rebuild scraped/socials.json (all tenants)
   ```
   Hit rate: ~11% of scraped restaurants (45/407) have recognizable socials on their static landing HTML. Many small-operator sites have none or render them via JS (which the regex-based scraper can't see). The UI gracefully hides the icon row when empty. A profile-root URL is preferred over a deep-link (e.g. `instagram.com/foo` beats `instagram.com/p/<id>`). **Watch out for false positives**: some WordPress/Wix templates ship with placeholder social links in the footer — a handful of cached entries point at the theme author's socials rather than the restaurant's. If you spot one, fix it with a `/admin/settings` edit or a manual `UPDATE "Restaurant" SET socials='{...}'::jsonb WHERE slug='...';`.

7. **Visit** `http://<slug>.localhost:3000` (modern browsers resolve `*.localhost` to `127.0.0.1` automatically).

8. **Grant tenant admin access** (optional). By default a scraped tenant has no `RestaurantMember` rows — only superadmins can manage it. To let a specific user in:
   ```sql
   INSERT INTO "RestaurantMember" (id, "userId", "restaurantId", role, "createdAt")
   VALUES (gen_random_uuid()::text, '<userId>', '<restaurantId>', 'admin', NOW());
   ```

## Common tasks (and what's actually being asked)

| User asks for… | What to do |
|---|---|
| "create a tenant for Kamei" | `--find "Kamei"`, then `--id <rid>` (single location) or per-location. |
| "restore sushi-cal-lougheed" | `--id GEi4YnE0UeYZI3wJxlRo --location fwizLHhySIAZPZ7jnERj --slug sushi-cal-lougheed`. |
| "add another location of Sushi California" | Find the location id in the scraped JSON, then `--id GEi4YnE0UeYZI3wJxlRo --location <lid>`. |
| "import everything" | `--all --active-only`. **Confirm first** — it deletes existing scraped rows. |
| "re-scrape from source" | `python3 scripts/scrape_codefusion.py` (resumable). Then re-run the importer. Scrape data sits in `scraped/restaurants/*.json` + `scraped/index.json`. |

## Gotchas

- **Prisma client staleness**: after a migration, always restart the dev server. Next.js caches the generated client per-process and won't pick up new fields otherwise.
- **`tsx` doesn't auto-load `.env.local`** — only `.env`. That's why `DATABASE_URL` lives in both files. The Prisma CLI reads `.env`; Next.js reads `.env.local`.
- **Subdomain cookie scoping**: NextAuth cookies are scoped per-host. A session set on `localhost:3000` doesn't cover `foo.localhost:3000`. Have the user log in on the subdomain they want to admin.
- **$USER expansion**: if you see `DATABASE_URL="postgresql://$USER@..."` and the connection fails with `role "$USER"`, the shell never expanded `$USER`. Replace with the actual username.
- **Scraped products with bad price**: some rows have `price: "NaN"` (e.g. Maple Sushi's "Special Order" placeholder). `isProductImportable` filters them; otherwise Prisma rejects the whole menu create.
- **Multi-Restaurant-doc brands**: a single brand (Sushi California) has multiple CodeFusion Restaurant docs (`1..4`), each listing the same set of locations. The new importer upserts by `loc._id`, so running across all Restaurant docs is idempotent (last one wins for shared locations). Just be aware per-location data might differ slightly between Restaurant docs — expect minor data variation if re-running a subset.

## Files you'll end up touching

- `scripts/import-from-scrape.ts` — the importer. Main entry points: `importOne` (top-level), `importLocation` (per-location), `upsertBrand`. All the field-extraction helpers (`hoursFromLocation`, `formatPhone`, `cleanRestaurantName`, `cleanLocationName`, `isProductImportable`) live here.
- `scripts/scrape_codefusion.py` — the scraper. Resumable; uses the public Firebase API key that ships with the CodeFusion client. Not authenticated as any user. Re-run is safe.
- `scripts/scrape-socials.ts` — extracts social URLs from tenant landing pages. Two main modes: `--build-cache` walks `scraped/index.json`, dedupes by URL, fetches with bounded concurrency (`--concurrency N`, default 10), and writes `scraped/socials.json` keyed by CodeFusion restaurant `_id`; the importer reads from this cache. `--slug <slug>` does a live fetch and writes directly to the DB (refresh). Also: `--all [--missing-only]` (live backfill across all DB rows), `--url <url>` (ad-hoc), `--dry-run`. Prefers profile-root URLs over deep-links (posts/reels/videos) and strips tracking params.
- `scraped/socials.json` — pre-built cache of social URLs per scraped CodeFusion restaurant. Generated by `--build-cache`. Safe to delete and regenerate; safe to commit.
- `prisma/schema.prisma` — the data model.
- `lib/tenant/display.ts` — `displayTenantName`, `tenantBannerUrl`.
- `lib/tenant/hours.ts` — `parseHours`, `openStatus`, `groupByDay`.
- `lib/tenant/socials.ts` — `SOCIAL_PLATFORMS`, `parseSocials(json)`, `SOCIAL_LABEL`. Platforms currently recognized: instagram, facebook, twitter, tiktok, youtube, linkedin.
- `lib/menu/tags.ts` — tag registry.
- `lib/fake-stats.ts` — placeholder popularity; replace when real order data exists.
