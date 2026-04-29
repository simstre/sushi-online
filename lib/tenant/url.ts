import { headers } from "next/headers";

export const TENANT_MODE: "subdomain" | "path" =
  process.env.NEXT_PUBLIC_TENANT_MODE === "path" ? "path" : "subdomain";

/**
 * Build an internal in-tenant URL that's correct for the active routing
 * mode.
 *
 * - **subdomain mode** (default): pass-through. The host already carries
 *   the tenant, so `/menu`, `/cart`, etc. work as-is.
 * - **path mode**: prepends `/t/<slug>` so the link stays inside the
 *   tenant after navigation.
 *
 * Pass an external URL (`http://...`, `mailto:...`) and we leave it
 * alone. Pass a relative path and we leave it alone too — only paths
 * starting with `/` are tenant-prefixed.
 *
 * Server component helper. For client components, use <TenantLink>.
 */
export async function tenantHref(path: string): Promise<string> {
  if (TENANT_MODE === "subdomain") return path;
  if (!path.startsWith("/")) return path;
  if (path.startsWith("/t/")) return path;

  const slug = await currentTenantSlug();
  if (!slug) return path;
  return `/t/${slug}${path === "/" ? "" : path}`;
}

/** Reads the resolved tenant slug from the middleware-set request header. */
export async function currentTenantSlug(): Promise<string | null> {
  const h = await headers();
  return h.get("x-tenant-slug");
}

/**
 * Build a fully-qualified storefront URL (e.g. for outbound emails or
 * platform-admin links into a tenant). Uses subdomain or path form
 * depending on TENANT_MODE.
 */
export function storefrontUrl(slug: string, path = "/"): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const proto = rootDomain.startsWith("localhost") ? "http" : "https";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (TENANT_MODE === "path") {
    return `${proto}://${rootDomain}/t/${slug}${normalized === "/" ? "" : normalized}`;
  }
  return `${proto}://${slug}.${rootDomain}${normalized}`;
}
