import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/db/prisma";
import { requireTenantOwner } from "@/lib/auth/require";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { storefrontUrl } from "@/lib/tenant/url";

export const runtime = "nodejs";

/**
 * Start (or resume) Stripe Connect Express onboarding for the current tenant.
 *
 * - Creates a new Express account if the tenant doesn't have one yet.
 * - Generates a fresh Account Link and returns its URL. The link is single-
 *   use and short-lived; clients always hit this endpoint to get a new one.
 *
 * Owner-only (admin role or superadmin); staff cannot connect Stripe.
 */
export async function POST() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 404 });

  const gate = await requireTenantOwner(tenant.id);
  if (gate instanceof NextResponse) return gate;

  let accountId = tenant.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: gate.email,
      business_profile: {
        name: tenant.locationName ? `${tenant.name} — ${tenant.locationName}` : tenant.name,
        product_description: "Online food ordering via comfyBites",
      },
      metadata: { restaurantId: tenant.id, restaurantSlug: tenant.slug },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    accountId = account.id;
    await prisma.restaurant.update({
      where: { id: tenant.id },
      data: { stripeAccountId: accountId, stripeChargesEnabled: false },
    });
  }

  // Build refresh / return URLs against the storefront base URL — picks the
  // right host shape for subdomain vs path mode multi-tenancy.
  const refreshUrl = storefrontUrl(tenant.slug, "/admin/settings?stripe=refresh");
  const returnUrl = storefrontUrl(tenant.slug, "/admin/settings?stripe=return");

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: link.url, accountId });
}
