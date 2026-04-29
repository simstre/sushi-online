// Client-side tenant URL helpers — counterparts to lib/tenant/url.ts.
//
// In path mode (NEXT_PUBLIC_TENANT_MODE=path), absolute paths must be
// prefixed with `/t/<slug>` so the middleware can resolve the tenant.
// In subdomain mode, the prefix is a no-op.

const TENANT_MODE: "subdomain" | "path" =
  process.env.NEXT_PUBLIC_TENANT_MODE === "path" ? "path" : "subdomain";

/** Reads the slug from the current pathname (`/t/<slug>/...`) on the client. */
export function currentSlugFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  return pathname.match(/^\/t\/([a-z0-9][a-z0-9-]*)/i)?.[1] ?? null;
}

/**
 * Prefixes an absolute in-tenant path with `/t/<slug>` when in path mode.
 * No-op in subdomain mode, on external URLs, on relative paths, and on
 * already-prefixed paths.
 */
export function tenantPath(path: string, slug: string | null | undefined): string {
  if (TENANT_MODE === "subdomain") return path;
  if (!path.startsWith("/")) return path;
  if (path.startsWith("/t/")) return path;
  if (!slug) return path;
  return `/t/${slug}${path === "/" ? "" : path}`;
}

/**
 * Drop-in replacement for fetch() that prefixes API URLs with the
 * current tenant in path mode, so the middleware can populate
 * `x-tenant-slug` for the request.
 *
 * Use only on the client (reads window.location).
 */
export function tenantFetch(path: string, init?: RequestInit): Promise<Response> {
  if (TENANT_MODE === "subdomain" || typeof window === "undefined") {
    return fetch(path, init);
  }
  const slug = currentSlugFromPath(window.location.pathname);
  return fetch(tenantPath(path, slug), init);
}
