/**
 * Import a CodeFusion-scraped menu into Prisma.
 *
 *   pnpm tsx scripts/import-from-scrape.ts --id <restaurantId>
 *   pnpm tsx scripts/import-from-scrape.ts --id <id> --slug sushi-cal --location <lid>
 *   pnpm tsx scripts/import-from-scrape.ts --all --active-only
 *   pnpm tsx scripts/import-from-scrape.ts --find "sushi california"
 *
 * Default behaviour for one restaurant:
 *   - picks the first active location
 *   - uses that location's "default" menu (falls back to first menu)
 *   - replaces any existing Menus under that Restaurant (idempotent)
 */
import { Prisma, PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const SCRAPED = path.join(process.cwd(), "scraped");
const RESTAURANTS_DIR = path.join(SCRAPED, "restaurants");
const INDEX_PATH = path.join(SCRAPED, "index.json");
const SOCIALS_CACHE_PATH = path.join(SCRAPED, "socials.json");

// Built by `scripts/scrape-socials.ts --build-cache` — one entry per CodeFusion
// restaurant `_id`. Missing cache is not an error; the importer just won't
// populate `Restaurant.socials`.
type SocialsCacheEntry = {
  landingUrl: string;
  scrapedAt: string;
  socials: Record<string, string>;
  error?: string;
};
let _socialsCache: Record<string, SocialsCacheEntry> | null | undefined;
function getSocialsFromCache(restaurantDocId: string): Record<string, string> | null {
  if (_socialsCache === undefined) {
    try {
      const raw = JSON.parse(fs.readFileSync(SOCIALS_CACHE_PATH, "utf8"));
      _socialsCache = raw.byId ?? null;
    } catch {
      _socialsCache = null;
    }
  }
  const entry = _socialsCache?.[restaurantDocId];
  if (!entry || !entry.socials || Object.keys(entry.socials).length === 0) return null;
  return entry.socials;
}

type CfProduct = {
  _id: string;
  categoryId?: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  activeAfter?: number;
  active?: boolean;
  inactive?: boolean;
  modifiers?: string[]; // modifier group IDs to resolve against menu.modifiers[]
};
type CfCategory = {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  productOrder?: string[];
  active?: boolean;
  inactive?: boolean;
};
type CfMenu = {
  name?: string;
  categoryOrder?: string[];
  active?: boolean;
};

function isProductActive(p: CfProduct, nowMs: number): boolean {
  if (p.activeAfter) return nowMs > p.activeAfter;
  return p.active !== false;
}

/** Some scraped rows are spreadsheet garbage (price: "NaN", name: "#N/A"). Drop them. */
function isProductImportable(p: CfProduct): boolean {
  if (!p.name || typeof p.name !== "string") return false;
  const price = p.price as unknown;
  return typeof price === "number" && Number.isFinite(price) && price >= 0;
}

function isCategoryActive(c: CfCategory): boolean {
  return c.active !== false && !c.inactive;
}
type CfLocation = {
  _id: string;
  address?: string;
  locationName?: string;
  phoneNumber?: string;
  hours?: Record<string, { open?: number; close?: number; breakStart?: number; breakEnd?: number }>;
  stripeAccountId?: string;
  googleMapsUrl?: string;
  welcomeMessage?: { title?: string; body?: string };
  minOrder?: number;
  waitTime?: number;
  tipValues?: number[];
  bagFee?: { amount?: number; taxRate?: number };
  orderOpen?: boolean;
  inactive?: boolean;
  menus?: Record<string, CfMenu>;
};

type HoursEntry = { day: number; open: string; close: string };

/**
 * CodeFusion stores hours as epoch milliseconds with a throwaway date; only
 * the time-of-day portion matters. We extract HH:mm in America/Vancouver since
 * these restaurants are in BC. Tweak the timezone if importing chains elsewhere.
 */
const RESTAURANT_TZ = process.env.CF_RESTAURANT_TZ || "America/Vancouver";

function toHHMM(ms: number | undefined | null): string | null {
  if (!ms || typeof ms !== "number") return null;
  try {
    return new Date(ms).toLocaleString("en-GB", {
      timeZone: RESTAURANT_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return null;
  }
}

function hoursFromLocation(loc: CfLocation): HoursEntry[] {
  const src = loc.hours;
  if (!src || typeof src !== "object") return [];
  const out: HoursEntry[] = [];
  for (const [key, slot] of Object.entries(src)) {
    const day = Number.parseInt(key, 10);
    if (Number.isNaN(day) || day < 0 || day > 6) continue;
    const open = toHHMM(slot?.open);
    const close = toHHMM(slot?.close);
    if (!open || !close || open === close) continue;
    // Drop the "zero" pseudo-closed entries some locations use.
    if (slot?.open === 0 || slot?.close === 0) continue;
    out.push({ day, open, close });
  }
  return out.sort((a, b) => a.day - b.day);
}

/** "6049318284" → "(604) 931-8284"; leaves anything non-NANP alone. */
function formatPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw.trim() || null;
}

/** Strip CodeFusion's trailing per-location index ("Sushi California 4" → "Sushi California"). */
function cleanRestaurantName(name: string): string {
  return name.replace(/\s+\d+$/, "").trim();
}

/** "1. Lougheed Location" → "Lougheed"; null for empty. */
function cleanLocationName(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/\s*location\s*$/i, "")
    .trim();
  return cleaned || null;
}
type Scraped = {
  _id: string;
  _scrapedAt?: string;
  restaurant: {
    _id: string;
    name: string;
    images?: Record<string, string>;
    landingUrl?: string;
    inactive?: boolean;
    styles?: Record<string, string>;
  };
  locations: CfLocation[];
  menusByLocation: Record<string, {
    categories: CfCategory[];
    products: CfProduct[];
    modifiers: CfModifierGroup[];
  }>;
};

type CfModifierChoice = {
  _id?: string;
  name: string;
  price?: number;
  posId?: string;
  posName?: string;
  selected?: boolean;
  activeAfter?: number;
  inactive?: boolean;
};
type CfModifierGroup = {
  _id: string;
  name: string;
  required?: 0 | 1;
  maxSelect?: number;
  choiceCount?: number;
  choices?: CfModifierChoice[];
  inactive?: boolean;
};

type MaterializedChoice = { id: string; name: string; price: number };
type MaterializedGroup = {
  id: string;
  name: string;
  required: boolean;
  // `1` = radio (single choice). `0` = unlimited. Other positive ints = capped multi-select.
  maxSelect: number;
  choices: MaterializedChoice[];
};

function materializeModifiers(
  groupIds: string[] | undefined,
  groupsById: Map<string, CfModifierGroup>,
  now: number,
): MaterializedGroup[] {
  if (!Array.isArray(groupIds) || groupIds.length === 0) return [];
  const out: MaterializedGroup[] = [];
  for (const gid of groupIds) {
    const g = groupsById.get(gid);
    if (!g || g.inactive === true) continue;
    const choices: MaterializedChoice[] = [];
    for (const [i, c] of (g.choices ?? []).entries()) {
      if (c.inactive === true) continue;
      if (typeof c.activeAfter === "number" && c.activeAfter > now) continue;
      const priceCents = Math.round((c.price ?? 0) * 100);
      if (!Number.isFinite(priceCents)) continue;
      // CodeFusion choices don't always have an _id, and `posId` gets reused
      // across choices in the same group (e.g. all "protein" options share one
      // posId). Always suffix with the index so every choice has a unique id.
      const id = c._id ? c._id : `${gid}:${i}`;
      choices.push({ id, name: c.name, price: priceCents });
    }
    if (choices.length === 0) continue;
    out.push({
      id: g._id,
      name: g.name,
      required: g.required === 1,
      maxSelect: typeof g.maxSelect === "number" && g.maxSelect > 0 ? g.maxSelect : 0,
      choices,
    });
  }
  return out;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[k] = true;
    } else {
      args[k] = next;
      i++;
    }
  }
  return args;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "restaurant";
}

async function uniqueSlug(base: string, keepIfThis?: string): Promise<string> {
  let slug = base;
  let n = 2;
  while (true) {
    const existing = await prisma.restaurant.findUnique({ where: { slug } });
    if (!existing || existing.id === keepIfThis) return slug;
    slug = `${base}-${n++}`;
  }
}

function pickLocation(data: Scraped, override?: string): CfLocation | null {
  const active = data.locations.filter((l) => !l.inactive);
  if (override) {
    const loc = data.locations.find((l) => l._id === override);
    if (!loc) throw new Error(`Location ${override} not found on restaurant ${data._id}`);
    return loc;
  }
  return active[0] ?? data.locations[0] ?? null;
}

function pickMenu(loc: CfLocation, override?: string): CfMenu | null {
  const menus = loc.menus ?? {};
  if (override) return menus[override] ?? null;
  if (menus.default) return menus.default;
  const firstKey = Object.keys(menus)[0];
  return firstKey ? menus[firstKey] : null;
}

async function upsertBrand(r: Scraped["restaurant"]) {
  const brandName = cleanRestaurantName(r.name);
  const brandSlug = slugify(brandName);

  // If a Brand already exists on this slug, update the landingUrl/logo if empty.
  const existing = await prisma.brand.findUnique({ where: { slug: brandSlug } });
  if (existing) {
    if (!existing.landingUrl && r.landingUrl) {
      await prisma.brand.update({
        where: { id: existing.id },
        data: { landingUrl: r.landingUrl },
      });
    }
    if (!existing.logoUrl && (r.images?.logo || r.images?.logoTitle)) {
      await prisma.brand.update({
        where: { id: existing.id },
        data: { logoUrl: r.images?.logo || r.images?.logoTitle || null },
      });
    }
    return existing;
  }

  return prisma.brand.create({
    data: {
      name: brandName,
      slug: brandSlug,
      landingUrl: r.landingUrl || null,
      logoUrl: r.images?.logo || r.images?.logoTitle || null,
    },
  });
}

async function importLocation(
  scraped: Scraped,
  loc: CfLocation,
  brandId: string,
  opts: { slugOverride?: string; menuKey?: string; dryRun?: boolean },
): Promise<{ id: string; slug: string } | null> {
  const r = scraped.restaurant;
  const menuData = scraped.menusByLocation[loc._id];
  if (!menuData) {
    console.log(`  skip: no menu data for ${r.name}/${loc._id}`);
    return null;
  }

  const categoriesById = new Map(menuData.categories.map((c) => [c._id, c]));
  const productsById = new Map(menuData.products.map((p) => [p._id, p]));
  const modifierGroupsById = new Map(
    (menuData.modifiers ?? []).map((m) => [m._id, m]),
  );

  // Category order: union of categoryOrder across every active menu on the location,
  // in the same priority order the live client uses (menu9..menu1, default last).
  const menus = loc.menus ?? {};
  const menuKeysInOrder = ["menu9", "menu8", "menu7", "menu6", "menu5", "menu4", "menu3", "menu2", "menu1", "default"];
  const concatOrder: string[] = [];
  for (const k of menuKeysInOrder) {
    const m = menus[k];
    if (!m || m.active === false) continue;
    concatOrder.push(...(m.categoryOrder ?? []));
  }
  let categoryOrder = Array.from(new Set(concatOrder));
  if (categoryOrder.length === 0 && menus.default?.categoryOrder) {
    categoryOrder = menus.default.categoryOrder;
  }
  categoryOrder = categoryOrder.filter((cid) => categoriesById.has(cid));
  const locMenu = pickMenu(loc, opts.menuKey);

  // Slug: <brand>-<location>; falls back to just brand if no location name.
  const brandSlug = slugify(cleanRestaurantName(r.name));
  const locSlug = cleanLocationName(loc.locationName);
  const baseSlug = opts.slugOverride ?? (locSlug ? `${brandSlug}-${slugify(locSlug)}` : brandSlug);
  const slug = await uniqueSlug(baseSlug, loc._id);

  const hours = hoursFromLocation(loc);
  const sourceBlob = {
    scrapedAt: scraped._scrapedAt ?? null,
    restaurant: scraped.restaurant,
    location: loc,
    menus: menuData,
  };

  const restaurantPayload = {
    brandId,
    name: cleanRestaurantName(r.name),
    locationName: cleanLocationName(loc.locationName),
    slug,
    logoUrl: r.images?.logo || r.images?.logoTitle || null,
    bannerUrl: r.images?.menuHeader || r.images?.mainBg || null,
    currency: "CAD",
    address: loc.address?.trim() || null,
    phone: formatPhone(loc.phoneNumber),
    businessHours: hours.length > 0 ? (hours as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    externalStripeAccountId: loc.stripeAccountId || null,
    landingUrl: r.landingUrl || null,
    googleMapsUrl: loc.googleMapsUrl || null,
    socials: (() => {
      const s = getSocialsFromCache(scraped._id);
      return s ? (s as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
    })(),
    welcomeMessageTitle: loc.welcomeMessage?.title?.trim() || null,
    welcomeMessageBody: loc.welcomeMessage?.body?.trim() || null,
    minOrder: typeof loc.minOrder === "number" && loc.minOrder > 0
      ? Math.round(loc.minOrder * 100)
      : null,
    waitTimeMinutes: typeof loc.waitTime === "number" && loc.waitTime > 0 ? loc.waitTime : null,
    tipValues:
      Array.isArray(loc.tipValues) && loc.tipValues.length > 0
        ? (loc.tipValues as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    bagFee:
      loc.bagFee && typeof loc.bagFee === "object" && typeof loc.bagFee.amount === "number"
        ? ({
            amount: Math.round(loc.bagFee.amount * 100),
            taxRate: loc.bagFee.taxRate ?? 0,
          } as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    inactive: r.inactive === true || loc.inactive === true,
    orderOpen: loc.orderOpen !== false,
    source: sourceBlob as unknown as Prisma.InputJsonValue,
    sourceScrapedAt: scraped._scrapedAt ? new Date(scraped._scrapedAt) : null,
  };

  const now = Date.now();
  const toItem = (p: CfProduct, j: number) => {
    const {
      name: _n,
      description: _d,
      price: _p,
      imageUrl: _i,
      ...sourceRest
    } = p as CfProduct & Record<string, unknown>;
    const groups = materializeModifiers(p.modifiers, modifierGroupsById, now);
    return {
      name: p.name,
      description: p.description || null,
      price: Math.round((p.price ?? 0) * 100),
      imageUrl: p.imageUrl || null,
      sortOrder: j,
      isAvailable: true,
      taxRate: typeof (p as { taxRate?: number }).taxRate === "number"
        ? (p as { taxRate?: number }).taxRate!
        : null,
      source: sourceRest as unknown as Prisma.InputJsonValue,
      modifiers: groups.length > 0
        ? (groups as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    };
  };

  let totalItems = 0;
  const categoryPayload = categoryOrder
    .map((cid, idx) => {
      const c = categoriesById.get(cid)!;
      if (!isCategoryActive(c)) return null;
      const items = (c.productOrder ?? [])
        .map((pid) => productsById.get(pid))
        .filter((p): p is CfProduct => !!p && isProductActive(p, now) && isProductImportable(p))
        .map((p, j) => toItem(p, j));
      if (items.length === 0) return null;
      totalItems += items.length;
      return { name: c.name || "Untitled", order: idx, items: { create: items } };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c, i) => ({ ...c, order: i }));

  if (opts.dryRun) {
    console.log(
      `  DRY ${r.name} / ${loc.locationName ?? loc._id} → /${slug} : ${categoryPayload.length} cats, ${totalItems} items`,
    );
    return null;
  }

  // Tenant is keyed on the LOCATION's Firestore id (one tenant per physical location).
  const restaurant = await prisma.restaurant.upsert({
    where: { id: loc._id },
    create: { id: loc._id, ...restaurantPayload },
    update: restaurantPayload,
  });

  await prisma.menu.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.menu.create({
    data: {
      restaurantId: restaurant.id,
      name: locMenu?.name || "Main",
      categories: { create: categoryPayload },
    },
  });

  console.log(
    `  OK  ${r.name} / ${loc.locationName ?? "—"} → /${slug}  ${categoryPayload.length} cats · ${totalItems} items`,
  );
  return { id: restaurant.id, slug };
}

/**
 * Top-level import for one scraped restaurant doc: creates/updates the brand,
 * then iterates all active locations (or a specific one if --location is used).
 */
async function importOne(scraped: Scraped, opts: {
  slugOverride?: string;
  locationId?: string;
  menuKey?: string;
  dryRun?: boolean;
}): Promise<Array<{ id: string; slug: string }>> {
  const r = scraped.restaurant;
  const targets = opts.locationId
    ? scraped.locations.filter((l) => l._id === opts.locationId)
    : scraped.locations.filter((l) => !l.inactive);

  if (targets.length === 0) {
    console.log(`  skip: no active locations for ${r.name}`);
    return [];
  }

  const brand = opts.dryRun ? { id: "dry-run" } : await upsertBrand(r);

  const results: Array<{ id: string; slug: string }> = [];
  for (const loc of targets) {
    // slugOverride only applies when a single location is targeted.
    const slugOverride = opts.locationId ? opts.slugOverride : undefined;
    const res = await importLocation(scraped, loc, brand.id, {
      slugOverride,
      menuKey: opts.menuKey,
      dryRun: opts.dryRun,
    });
    if (res) results.push(res);
  }
  return results;
}

function loadScraped(id: string): Scraped {
  const p = path.join(RESTAURANTS_DIR, `${id}.json`);
  if (!fs.existsSync(p)) throw new Error(`No scraped file for ${id}`);
  return JSON.parse(fs.readFileSync(p, "utf8")) as Scraped;
}

function loadIndex(): { restaurants: Array<{ id: string; name: string; inactive?: boolean; products: number }> } {
  return JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.find) {
    const q = String(args.find).toLowerCase();
    const idx = loadIndex();
    const matches = idx.restaurants.filter((r) => (r.name ?? "").toLowerCase().includes(q));
    for (const m of matches) {
      console.log(`  ${m.id}  ${m.name}${m.inactive ? "  (inactive)" : ""}  prods=${m.products}`);
    }
    console.log(`${matches.length} matches.`);
    return;
  }

  const dryRun = !!args["dry-run"];
  const menuKey = typeof args.menu === "string" ? args.menu : undefined;
  const locationId = typeof args.location === "string" ? args.location : undefined;
  const slugOverride = typeof args.slug === "string" ? args.slug : undefined;

  if (args.all) {
    const idx = loadIndex();
    const activeOnly = !!args["active-only"];
    const targets = idx.restaurants.filter((r) => (activeOnly ? !r.inactive : true) && r.products > 0);
    const limit = typeof args.limit === "string" ? parseInt(args.limit, 10) : 0;
    const slice = limit > 0 ? targets.slice(0, limit) : targets;

    // One-time cleanup: old rows were keyed on Restaurant-doc IDs (r._id).
    // The new importer keys on location IDs (loc._id), so Restaurant-doc-keyed
    // rows will be orphaned. Delete them (and their menus via cascade) before import.
    // Never touches rows created outside this importer (e.g. our seeded cuid "taro").
    if (!dryRun) {
      const legacyIds = slice.map((t) => t.id);
      const deleted = await prisma.restaurant.deleteMany({
        where: { id: { in: legacyIds } },
      });
      if (deleted.count > 0) {
        console.log(`Cleanup: deleted ${deleted.count} legacy Restaurant-doc-keyed rows.`);
      }
    }

    console.log(`Importing ${slice.length} restaurants${dryRun ? " (dry run)" : ""}`);
    let ok = 0;
    let fail = 0;
    let locations = 0;
    for (const t of slice) {
      try {
        const s = loadScraped(t.id);
        const results = await importOne(s, { dryRun, menuKey, locationId });
        locations += results.length;
        ok++;
      } catch (e) {
        console.error(`  ERR ${t.name} (${t.id}):`, (e as Error).message);
        fail++;
      }
    }
    console.log(`Done: ${ok} restaurant docs OK, ${fail} failed, ${locations} location tenants imported.`);
    return;
  }

  if (!args.id) {
    console.error("Usage: import-from-scrape.ts --id <restaurantId> [--slug x] [--location y] [--menu default]");
    console.error("       import-from-scrape.ts --find <name-substring>");
    console.error("       import-from-scrape.ts --all [--active-only] [--limit N] [--dry-run]");
    process.exit(1);
  }

  const scraped = loadScraped(String(args.id));
  await importOne(scraped, { slugOverride, locationId, menuKey, dryRun });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
