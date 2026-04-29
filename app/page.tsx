import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CreditCard,
  Globe,
  MapPin,
  Receipt,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { displayTenantName } from "@/lib/tenant/display";
import { MOST_LIKED_SLUG } from "@/lib/fake-stats";

export const dynamic = "force-dynamic";

// Forest & Mustard hex tokens used in inline gradient strings (Tailwind
// arbitrary values don't compose multi-stop CSS).
const FOREST = "#34503D";
const FOREST_DEEP = "#1c2a22";
const BAG = "#D9A441";
const SAGE = "#9BB58A";
const CREAM = "#F8F1E4";

export default async function RootPage() {
  // On a tenant subdomain, send the customer straight to the menu.
  const tenant = await getTenantFromHeaders();
  if (tenant) redirect(`/menu/${MOST_LIKED_SLUG}`);

  const [restaurantCount, paidOrderAgg, featured] = await Promise.all([
    prisma.restaurant.count({ where: { inactive: false } }).catch(() => 0),
    prisma.order
      .aggregate({ where: { status: "paid" }, _count: true })
      .catch(() => ({ _count: 0 })),
    prisma.restaurant
      .findMany({
        where: { inactive: false, logoUrl: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, name: true, locationName: true, slug: true, logoUrl: true },
      })
      .catch(
        () =>
          [] as Array<{
            id: string;
            name: string;
            locationName: string | null;
            slug: string;
            logoUrl: string | null;
          }>,
      ),
  ]);

  const ordersServed = paidOrderAgg._count;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const proto = rootDomain.startsWith("localhost") ? "http" : "https";

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-white text-brand-primary">
      {/* Hero */}
      <section className="relative isolate flex min-h-[100svh] flex-col">
        {/* Warm light background — animated cream + sage radial glows on white. */}
        <div className="absolute inset-0 -z-20" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(55% 45% at 18% 22%, ${BAG}33 0%, transparent 60%), radial-gradient(55% 45% at 82% 78%, ${SAGE}40 0%, transparent 60%), linear-gradient(180deg, #ffffff 0%, ${CREAM} 100%)`,
              backgroundSize: "200% 200%, 200% 200%, 100% 100%",
              animation: "comfyBitesBg 22s ease-in-out infinite alternate",
            }}
          />
        </div>
        {/* Decorative dotted orbital ring (background motif). */}
        <svg
          className="pointer-events-none absolute left-1/2 top-1/2 -z-[15] h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 opacity-[0.08]"
          viewBox="0 0 1000 1000"
          aria-hidden
        >
          <circle cx="500" cy="500" r="420" fill="none" stroke={FOREST} strokeWidth="1.5" strokeDasharray="2 10" />
          <circle cx="500" cy="500" r="300" fill="none" stroke={FOREST} strokeWidth="1.5" strokeDasharray="2 10" />
        </svg>

        <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10 md:py-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="comfyBites home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" aria-hidden className="h-8 w-8 md:h-9 md:w-9" />
            <span
              className="font-display text-xl font-bold tracking-tight md:text-2xl"
              style={{ color: FOREST }}
            >
              comfy<span style={{ color: BAG }}>Bites</span>
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium text-brand-primary/70">
            <a href="#features" className="hover:text-brand-primary">
              Features
            </a>
            <a href="#restaurants" className="hover:text-brand-primary">
              Restaurants
            </a>
          </nav>
        </header>

        <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-10 px-6 pb-24 pt-8 md:grid-cols-[1.05fr_1fr] md:gap-14 md:px-10 md:pb-32 md:pt-12">
          {/* Headline column */}
          <div className="text-center md:text-left">
            <span
              className="mb-5 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em]"
              style={{ borderColor: `${FOREST}26`, color: FOREST }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: BAG }}
              />
              Hot · Fresh · Delivered · {restaurantCount.toLocaleString()} live
            </span>
            <h1
              className="text-balance font-display text-5xl font-bold leading-[1.02] tracking-[-0.02em] md:text-7xl"
              style={{ color: FOREST }}
            >
              Online ordering that
              <br />
              <em className="font-display italic" style={{ color: FOREST }}>
                feels like home
              </em>
              .
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-brand-primary/75 md:mx-0 md:text-lg">
              comfyBites gives independent restaurants a fast, branded ordering site on their
              own domain — with payments, menus, and analytics built in. No commission on every
              order. Your customers, your data.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row md:justify-start">
              <a
                href="#contact"
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition hover:opacity-90"
                style={{ backgroundColor: FOREST, color: CREAM }}
              >
                Get your restaurant online
              </a>
              <a
                href="#restaurants"
                className="inline-flex items-center justify-center rounded-full border bg-white px-6 py-3 text-sm font-semibold transition hover:bg-brand-cream"
                style={{ borderColor: `${FOREST}26`, color: FOREST }}
              >
                See restaurants ↓
              </a>
            </div>
          </div>

          {/* Illustration column */}
          <div className="relative mx-auto w-full max-w-md md:max-w-none">
            <div
              className="absolute -inset-4 rounded-[40px] opacity-70"
              aria-hidden
              style={{
                background: `radial-gradient(60% 60% at 50% 30%, ${BAG}33 0%, transparent 70%)`,
              }}
            />
            <div className="cb-float-y relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/illustrations/hero-light.svg"
                alt="Phone showing a live food order with floating dishes"
                className="relative mx-auto block h-auto w-full max-w-[480px] drop-shadow-[0_24px_40px_rgba(52,80,61,0.18)]"
              />
            </div>
          </div>
        </div>

        {/* Stats strip pinned to hero bottom */}
        <div
          className="relative z-10 border-t bg-white/80 backdrop-blur"
          style={{ borderColor: `${FOREST}1A` }}
        >
          <div
            className="mx-auto grid max-w-5xl grid-cols-3 divide-x px-6 py-5 text-center md:py-6"
            style={{ borderColor: `${FOREST}1A` }}
          >
            <Stat label="Restaurants live" value={restaurantCount.toLocaleString()} />
            <Stat label="Orders served" value={ordersServed.toLocaleString()} />
            <Stat label="Setup time" value="< 1 day" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="relative z-10 bg-white px-6 py-20 md:px-10 md:py-28"
      >
        <div className="mx-auto max-w-5xl">
          <p
            className="font-mono text-xs uppercase tracking-[0.28em]"
            style={{ color: FOREST }}
          >
            Why comfyBites
          </p>
          <h2
            className="mt-3 text-balance font-display text-3xl font-bold tracking-tight md:text-5xl"
            style={{ color: FOREST }}
          >
            Everything a restaurant needs to take orders direct.
          </h2>
          <p className="mt-3 max-w-2xl text-brand-primary/70">
            Skip the marketplace fees. Run ordering on your own subdomain in your own colors,
            with payments going straight to your bank.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Feature
              icon={Globe}
              title="Your brand, your domain"
              body="Each restaurant gets a custom subdomain with its own logo, colors, and welcome message. Looks like yours, runs like ours."
            />
            <Feature
              icon={CreditCard}
              title="Stripe-native payments"
              body="Stripe Connect or platform-direct. Pick one and start accepting cards in minutes. PCI handled by Stripe — never touches our servers."
            />
            <Feature
              icon={UtensilsCrossed}
              title="Menus that actually work"
              body="Categories, modifiers, tags, and per-item availability. Staff edit the menu live. Customers see prices in cents — no rounding tricks."
            />
            <Feature
              icon={Receipt}
              title="Receipts on autopilot"
              body="Branded receipt emails go out the moment a payment clears. Owners get a real-time order feed and a financial dashboard."
            />
            <Feature
              icon={Users}
              title="Roles for the whole team"
              body="Owners see revenue. Staff see orders. Members request access; owners approve. No spreadsheet of passwords."
            />
            <Feature
              icon={MapPin}
              title="Built for many locations"
              body="Brands group multiple locations under one umbrella. Each location is its own subdomain with its own menu and Stripe account."
            />
          </div>
        </div>
      </section>

      {/* Restaurants strip */}
      <section
        id="restaurants"
        className="relative z-10 border-t border-b border-brand-primary/10 bg-brand-cream/60 px-6 py-20 md:px-10 md:py-24"
      >
        <div className="mx-auto max-w-5xl">
          <p
            className="font-mono text-xs uppercase tracking-[0.28em]"
            style={{ color: FOREST }}
          >
            The community
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                className="text-balance font-display text-3xl font-bold tracking-tight md:text-5xl"
                style={{ color: FOREST }}
              >
                On comfyBites today.
              </h2>
              <p className="mt-2 text-brand-primary/70">
                A few of the restaurants taking orders through comfyBites.
              </p>
            </div>
          </div>

          {featured.length === 0 ? (
            <p
              className="mt-10 rounded-2xl border bg-white p-8 text-center text-sm text-brand-primary/60"
              style={{ borderColor: `${FOREST}1A` }}
            >
              Restaurants will appear here once they finish onboarding.
            </p>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {featured.map((r) => (
                <a
                  key={r.id}
                  href={`${proto}://${r.slug}.${rootDomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-2xl border bg-white p-3 transition hover:shadow-md"
                  style={{ borderColor: `${FOREST}1A` }}
                >
                  {r.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.logoUrl}
                      alt={r.name}
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${BAG}25` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/icon.svg" alt="" aria-hidden className="h-9 w-9" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: FOREST }}
                    >
                      {displayTenantName(r)}
                    </p>
                    <p className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-brand-primary/55">
                      {r.slug}.{rootDomain.split(":")[0]}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA — inverse forest panel */}
      <section
        id="contact"
        className="relative z-10 overflow-hidden px-6 py-24 md:px-10"
        style={{ backgroundColor: FOREST_DEEP, color: CREAM }}
      >
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background: `radial-gradient(50% 60% at 80% 20%, ${BAG}33 0%, transparent 70%), radial-gradient(50% 60% at 15% 85%, ${SAGE}33 0%, transparent 70%)`,
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <p
            className="font-mono text-xs uppercase tracking-[0.28em]"
            style={{ color: BAG }}
          >
            Get started
          </p>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight md:text-5xl">
            Ready to take orders{" "}
            <em className="font-display italic" style={{ color: BAG }}>
              direct
            </em>
            ?
          </h2>
          <p className="mt-4 text-balance text-base leading-relaxed text-brand-cream/80 md:text-lg">
            Tell us about your restaurant. We&apos;ll spin up your subdomain, import your menu,
            and walk you through Stripe in one short call.
          </p>
          <div className="mt-8 flex justify-center">
            <a
              href="mailto:hello@comfybites.app"
              className="inline-flex items-center justify-center rounded-full px-7 py-3 text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: CREAM, color: FOREST }}
            >
              hello@comfybites.app
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative z-10 border-t bg-white px-6 py-10 text-sm md:px-10"
        style={{ borderColor: `${FOREST}1A`, color: `${FOREST}99` }}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" aria-hidden className="h-6 w-6" />
            <span
              className="font-display text-base font-bold"
              style={{ color: FOREST }}
            >
              comfy<span style={{ color: BAG }}>Bites</span>
            </span>
            <span
              className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em]"
              style={{ color: `${FOREST}66` }}
            >
              © {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#features" className="hover:text-brand-primary">
              Features
            </a>
            <a href="#restaurants" className="hover:text-brand-primary">
              Restaurants
            </a>
            <a href="mailto:hello@comfybites.app" className="hover:text-brand-primary">
              Contact
            </a>
          </div>
        </div>
      </footer>

      <style>
        {`
          @keyframes comfyBitesBg {
            0% { background-position: 0% 0%, 100% 100%, 0 0; }
            100% { background-position: 100% 100%, 0% 0%, 0 0; }
          }
          @keyframes cbFloatY {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          .cb-float-y { animation: cbFloatY 6s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .cb-float-y { animation: none; }
          }
        `}
      </style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2">
      <p
        className="font-display text-2xl font-bold tracking-tight md:text-3xl"
        style={{ color: FOREST }}
      >
        {value}
      </p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-brand-primary/55">
        {label}
      </p>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-2xl border bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: `${FOREST}1A` }}
    >
      <div
        className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${FOREST}14`, color: FOREST }}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <h3
        className="font-display text-lg font-semibold"
        style={{ color: FOREST }}
      >
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-brand-primary/75">{body}</p>
    </div>
  );
}
