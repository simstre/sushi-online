import { NextRequest, NextResponse } from "next/server";
import { slugFromHost } from "@/lib/tenant/resolve";

// Exclude paths that must bypass tenant resolution:
// - /_next           Next.js internals
// - /favicon.ico     static asset
// - /uploads         local-fallback upload serving
// - /api/stripe/webhook  needs the raw body intact
// - /api/auth        Auth.js routes
export const config = {
  matcher: ["/((?!_next/|favicon.ico|uploads/|api/stripe/webhook|api/auth/).*)"],
};

const PATH_MODE_RE = /^\/t\/([a-z0-9][a-z0-9-]*)(\/.*)?$/i;

export function middleware(req: NextRequest) {
  const host = req.headers.get("host");
  const url = req.nextUrl;

  // Path-mode: /t/<slug>/... — extract the slug, rewrite the URL to drop the
  // prefix so the existing tenant routes ((tenant) group) handle it. This
  // lets us run multi-tenancy on a host without wildcard subdomains
  // (e.g. *.vercel.app) until a real domain is wired up.
  const pathMatch = url.pathname.match(PATH_MODE_RE);
  if (pathMatch) {
    const slug = pathMatch[1].toLowerCase();
    const rest = pathMatch[2] || "/";
    const rewritten = url.clone();
    rewritten.pathname = rest;
    const res = NextResponse.rewrite(rewritten);
    res.headers.set("x-tenant-slug", slug);
    return res;
  }

  // Subdomain-mode: read slug from the host header.
  const slug = slugFromHost(host);
  const res = NextResponse.next();
  if (slug) res.headers.set("x-tenant-slug", slug);
  return res;
}
