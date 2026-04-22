import { prisma } from "@/lib/db/prisma";
import { headers } from "next/headers";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

/**
 * Extract tenant slug from a Host header.
 * Examples:
 *   "taro.localhost:3000"            -> "taro"
 *   "taro.sushi-online.com"          -> "taro"
 *   "sushi-online.com" / "localhost" -> null (root domain, no tenant)
 */
export function slugFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0];
  const rootHostname = ROOT_DOMAIN.split(":")[0];

  if (hostname === rootHostname || hostname === `www.${rootHostname}`) return null;

  if (hostname.endsWith(`.${rootHostname}`)) {
    const sub = hostname.slice(0, hostname.length - rootHostname.length - 1);
    return sub || null;
  }

  // Fallback: treat first label as slug if it has at least one dot.
  const first = hostname.split(".")[0];
  return first || null;
}

export async function getTenantFromHeaders() {
  const h = await headers();
  const slug = h.get("x-tenant-slug") ?? slugFromHost(h.get("host"));
  if (!slug) return null;
  return prisma.restaurant.findUnique({ where: { slug } });
}

export async function requireTenant() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) throw new Error("No tenant resolved for this request");
  return tenant;
}
