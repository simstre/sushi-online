/**
 * Scrape social media links from a tenant's landingUrl and persist them
 * on Restaurant.socials.
 *
 *   npx tsx scripts/scrape-socials.ts --slug sushi-u-burnaby
 *   npx tsx scripts/scrape-socials.ts --slug sushi-u-burnaby --dry-run
 *   npx tsx scripts/scrape-socials.ts --all                 # every tenant with a landingUrl
 *   npx tsx scripts/scrape-socials.ts --all --missing-only  # only tenants with empty socials
 *   npx tsx scripts/scrape-socials.ts --url https://example.com --dry-run
 *
 * Strategy: fetch the landing URL, scan all href="…" values for known social
 * domains, take the first match per platform, normalize. No HTML parser — a
 * regex over href attributes is enough and keeps deps lean.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

export const SOCIALS_CACHE_PATH = path.join(
  process.cwd(),
  "scraped",
  "socials.json",
);

type SocialsCacheEntry = {
  landingUrl: string;
  scrapedAt: string;
  socials: Socials;
  error?: string;
};
type SocialsCache = {
  generatedAt: string;
  byId: Record<string, SocialsCacheEntry>;
};

export function loadSocialsCache(): SocialsCache | null {
  try {
    return JSON.parse(fs.readFileSync(SOCIALS_CACHE_PATH, "utf8"));
  } catch {
    return null;
  }
}

const prisma = new PrismaClient();

export type Socials = Partial<Record<Platform, string>>;

const PLATFORMS = [
  "instagram",
  "facebook",
  "twitter",
  "tiktok",
  "youtube",
  "linkedin",
] as const;
type Platform = (typeof PLATFORMS)[number];

// Host suffix → platform. Longest-match wins.
const HOST_MAP: Array<[RegExp, Platform]> = [
  [/(?:^|\.)instagram\.com$/i, "instagram"],
  [/(?:^|\.)facebook\.com$/i, "facebook"],
  [/(?:^|\.)fb\.com$/i, "facebook"],
  [/(?:^|\.)twitter\.com$/i, "twitter"],
  [/(?:^|\.)x\.com$/i, "twitter"],
  [/(?:^|\.)tiktok\.com$/i, "tiktok"],
  [/(?:^|\.)youtube\.com$/i, "youtube"],
  [/(?:^|\.)youtu\.be$/i, "youtube"],
  [/(?:^|\.)linkedin\.com$/i, "linkedin"],
];

// URLs that match a social host but aren't real profile links (sharers, SDKs, CDNs).
const NOISE = [
  /\/sharer/i,
  /\/share\.php/i,
  /\/intent\//i,
  /platform\.(twitter|instagram|linkedin)\.com/i,
  /connect\.facebook\.net/i,
  /staticxx\.facebook\.com/i,
  /widgets\.js/i,
];

function classify(rawUrl: string): Platform | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (NOISE.some((r) => r.test(u.href))) return null;
  for (const [rx, p] of HOST_MAP) if (rx.test(u.hostname)) return p;
  return null;
}

function normalize(rawUrl: string, platform: Platform): string {
  const u = new URL(rawUrl);
  u.protocol = "https:";
  u.hash = "";
  // Strip tracking params.
  for (const k of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid|igshid|ref|ref_src)/i.test(k)) u.searchParams.delete(k);
  }
  if (platform === "twitter" && u.hostname === "x.com") {
    u.hostname = "twitter.com";
  }
  return u.toString().replace(/\/+$/, "");
}

export async function extractSocials(pageUrl: string, timeoutMs = 10_000): Promise<Socials> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  let html: string;
  try {
    const res = await fetch(pageUrl, {
      redirect: "follow",
      signal: ac.signal,
      headers: {
        // Sites often block empty UAs; pretend to be a real browser.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } finally {
    clearTimeout(t);
  }

  const base = new URL(pageUrl);
  const candidates: Record<Platform, string[]> = {
    instagram: [],
    facebook: [],
    twitter: [],
    tiktok: [],
    youtube: [],
    linkedin: [],
  };

  // Scan every href/src/content attribute.
  const attrRe = /(?:href|src|content)\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(attrRe)) {
    const raw = m[1];
    if (!raw || raw.startsWith("#")) continue;
    let abs: string;
    try {
      abs = new URL(raw, base).toString();
    } catch {
      continue;
    }
    const platform = classify(abs);
    if (!platform) continue;
    const url = normalize(abs, platform);
    if (!candidates[platform].includes(url)) candidates[platform].push(url);
  }

  // Prefer profile-root URLs over deep-links (posts, reels, videos, sharers).
  const DEEP = /\/(p|reel|reels|tv|posts|watch|shorts|status|video|share|channel)\//i;
  const found: Socials = {};
  for (const p of PLATFORMS) {
    const list = candidates[p];
    if (!list.length) continue;
    const root = list.find((u) => !DEEP.test(new URL(u).pathname));
    found[p] = root ?? list[0];
  }
  return found;
}

function parseArgs(argv: string[]) {
  const get = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    slug: get("--slug"),
    all: argv.includes("--all"),
    missingOnly: argv.includes("--missing-only"),
    dryRun: argv.includes("--dry-run"),
    url: get("--url"),
    buildCache: argv.includes("--build-cache"),
    concurrency: Number(get("--concurrency") ?? 10),
  };
}

// Bounded-concurrency map. Preserves input order in results.
async function pmap<T, U>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<U>,
): Promise<U[]> {
  const out: U[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function scrapeOne(landingUrl: string) {
  try {
    const s = await extractSocials(landingUrl);
    return { ok: true as const, socials: s };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.buildCache) {
    const index = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "scraped", "index.json"), "utf8"),
    ) as { restaurants: Array<{ id: string; name: string; landingUrl?: string | null }> };

    // Only restaurants that have a landingUrl.
    const targets = index.restaurants.filter((r) => r.landingUrl);
    console.log(
      `Building socials cache: ${targets.length} restaurants with landingUrl (of ${index.restaurants.length})`,
    );

    // Dedupe by URL — many multi-location brands share one landing page.
    const byUrl = new Map<string, { socials: Socials; error?: string }>();
    const uniqueUrls = [...new Set(targets.map((r) => r.landingUrl!))];
    console.log(`  ${uniqueUrls.length} unique URLs, concurrency=${args.concurrency}`);

    let done = 0;
    await pmap(uniqueUrls, args.concurrency, async (url) => {
      const res = await scrapeOne(url);
      byUrl.set(url, res.ok ? { socials: res.socials } : { socials: {}, error: res.error });
      done++;
      if (done % 20 === 0 || done === uniqueUrls.length) {
        console.log(`    [${done}/${uniqueUrls.length}]`);
      }
    });

    const now = new Date().toISOString();
    const cache: SocialsCache = { generatedAt: now, byId: {} };
    let hits = 0;
    let empty = 0;
    let failed = 0;
    for (const r of targets) {
      const entry = byUrl.get(r.landingUrl!)!;
      const keys = Object.keys(entry.socials);
      cache.byId[r.id] = {
        landingUrl: r.landingUrl!,
        scrapedAt: now,
        socials: entry.socials,
        ...(entry.error ? { error: entry.error } : {}),
      };
      if (entry.error) failed++;
      else if (keys.length === 0) empty++;
      else hits++;
    }

    if (args.dryRun) {
      console.log(`DRY: would write ${Object.keys(cache.byId).length} entries to ${SOCIALS_CACHE_PATH}`);
    } else {
      fs.writeFileSync(SOCIALS_CACHE_PATH, JSON.stringify(cache, null, 2));
      console.log(`wrote ${SOCIALS_CACHE_PATH}`);
    }
    console.log(`done. with_socials=${hits}  empty=${empty}  failed=${failed}`);
    return;
  }

  if (args.url) {
    const r = await scrapeOne(args.url);
    console.log(args.url, "→", r);
    return;
  }

  if (args.slug) {
    const r = await prisma.restaurant.findUnique({ where: { slug: args.slug } });
    if (!r) throw new Error(`No restaurant with slug=${args.slug}`);
    if (!r.landingUrl) throw new Error(`Restaurant ${args.slug} has no landingUrl`);
    const res = await scrapeOne(r.landingUrl);
    if (!res.ok) {
      console.error(`  ERR ${args.slug}  ${r.landingUrl}  ${res.error}`);
      process.exitCode = 1;
      return;
    }
    const keys = Object.keys(res.socials);
    console.log(`  ${args.dryRun ? "DRY" : "OK "} ${args.slug}  ${r.landingUrl}  [${keys.join(", ") || "none"}]`);
    for (const [k, v] of Object.entries(res.socials)) console.log(`      ${k}: ${v}`);
    if (!args.dryRun) {
      await prisma.restaurant.update({
        where: { id: r.id },
        data: { socials: keys.length ? (res.socials as Prisma.InputJsonValue) : Prisma.DbNull },
      });
    }
    return;
  }

  if (args.all) {
    const where: Prisma.RestaurantWhereInput = args.missingOnly
      ? { landingUrl: { not: null }, socials: { equals: Prisma.DbNull } }
      : { landingUrl: { not: null } };
    const rows = await prisma.restaurant.findMany({
      where,
      select: { id: true, slug: true, landingUrl: true },
    });
    console.log(`Scraping ${rows.length} restaurants…`);
    let ok = 0;
    let empty = 0;
    let failed = 0;
    for (const r of rows) {
      const res = await scrapeOne(r.landingUrl!);
      if (!res.ok) {
        console.log(`  ERR ${r.slug}  ${res.error}`);
        failed++;
        continue;
      }
      const keys = Object.keys(res.socials);
      if (keys.length === 0) {
        empty++;
      } else {
        ok++;
      }
      console.log(`  ${args.dryRun ? "DRY" : "OK "} ${r.slug}  [${keys.join(", ") || "none"}]`);
      if (!args.dryRun) {
        await prisma.restaurant.update({
          where: { id: r.id },
          data: { socials: keys.length ? (res.socials as Prisma.InputJsonValue) : Prisma.DbNull },
        });
      }
    }
    console.log(`done. with_socials=${ok}  empty=${empty}  failed=${failed}`);
    return;
  }

  console.error(
    "Usage: --slug <slug> | --all [--missing-only] | --url <url> | --build-cache [--concurrency N]",
  );
  process.exit(2);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
