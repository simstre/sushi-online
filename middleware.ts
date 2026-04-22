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

export function middleware(req: NextRequest) {
  const host = req.headers.get("host");
  const slug = slugFromHost(host);

  const res = NextResponse.next();
  if (slug) res.headers.set("x-tenant-slug", slug);
  return res;
}
