import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Poppins } from "next/font/google";
import { CircleUserRound } from "lucide-react";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { displayTenantName } from "@/lib/tenant/display";
import { getCurrentUser } from "@/lib/auth/require";
import { CartBadge } from "./cart-badge";

const tenantNameFont = Poppins({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

export const dynamic = "force-dynamic";

function faviconHref(logoUrl: string | null): string {
  if (logoUrl) return logoUrl;
  // Food-themed fallback — inline SVG with sushi emoji, cached cheaply by the browser.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<text y="86" font-size="88">🍣</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return {};
  const name = displayTenantName(tenant);
  const icon = faviconHref(tenant.logoUrl);
  return {
    title: {
      default: name,
      template: `%s · ${name}`,
    },
    icons: {
      icon: [{ url: icon }],
      shortcut: [{ url: icon }],
      apple: [{ url: icon }],
    },
  };
}

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  const user = await getCurrentUser();

  const primary = tenant.primaryColor ?? "#111111";
  const secondary = tenant.secondaryColor ?? "#f4f4f5";

  return (
    <div
      style={
        {
          ["--primary" as any]: primary,
          ["--primary-foreground" as any]: "#ffffff",
          ["--secondary" as any]: secondary,
          ["--secondary-foreground" as any]: "#111111",
        } as React.CSSProperties
      }
    >
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6 md:py-5">
          <Link href="/" className="flex items-center gap-3 min-w-0">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="h-11 w-11 rounded object-cover md:h-14 md:w-14"
              />
            ) : (
              <div
                className="h-11 w-11 rounded md:h-14 md:w-14"
                style={{ backgroundColor: primary }}
                aria-hidden
              />
            )}
            <span
              className={`${tenantNameFont.className} truncate text-lg font-bold md:text-2xl`}
            >
              {displayTenantName(tenant)}
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <Link
                href="/account"
                className="inline-flex items-center gap-1.5 text-sm hover:text-foreground"
                aria-label="Account"
              >
                <CircleUserRound className="h-5 w-5" />
                <span className="hidden sm:inline">Account</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Sign in
              </Link>
            )}
            <CartBadge currency={tenant.currency} minOrder={tenant.minOrder ?? 0} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 md:px-6">{children}</main>
    </div>
  );
}
