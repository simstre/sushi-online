"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef } from "react";

const TENANT_MODE: "subdomain" | "path" =
  process.env.NEXT_PUBLIC_TENANT_MODE === "path" ? "path" : "subdomain";

type Props = Omit<LinkProps, "href"> & {
  href: string;
  className?: string;
  children?: React.ReactNode;
  target?: string;
  rel?: string;
  "aria-label"?: string;
  title?: string;
};

/**
 * Drop-in replacement for <Link> that auto-prefixes the href with the
 * current tenant's path segment when running in path-mode multi-tenancy.
 *
 * - subdomain mode: behaves like next/link
 * - path mode: prepends `/t/<slug>` to absolute paths so navigation
 *   stays inside the tenant context (and the middleware can route it)
 *
 * External URLs (mailto:, http://) and relative paths pass through
 * unchanged. Already-prefixed paths (`/t/...`) pass through too.
 */
export const TenantLink = forwardRef<HTMLAnchorElement, Props>(function TenantLink(
  { href, ...rest },
  ref,
) {
  const pathname = usePathname();
  const finalHref = prefixHref(href, pathname);
  return <Link href={finalHref} {...rest} ref={ref} />;
});

export function prefixHref(href: string, pathname: string | null): string {
  if (TENANT_MODE === "subdomain") return href;
  if (!href.startsWith("/")) return href;
  if (href.startsWith("/t/")) return href;
  const slug = pathname?.match(/^\/t\/([a-z0-9][a-z0-9-]*)/i)?.[1];
  if (!slug) return href;
  return `/t/${slug}${href === "/" ? "" : href}`;
}
