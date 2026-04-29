import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/db/prisma";
import { requireTenantOwner } from "@/lib/auth/require";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";

export const runtime = "nodejs";

/**
 * Re-fetch the connected account from Stripe and sync `stripeChargesEnabled`
 * on the tenant. Called after the owner returns from the Stripe-hosted
 * onboarding flow, or whenever the UI wants to refresh status.
 */
export async function POST() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 404 });

  const gate = await requireTenantOwner(tenant.id);
  if (gate instanceof NextResponse) return gate;

  if (!tenant.stripeAccountId) {
    return NextResponse.json({ chargesEnabled: false, accountId: null });
  }

  const account = await stripe.accounts.retrieve(tenant.stripeAccountId);
  const chargesEnabled = Boolean(account.charges_enabled);

  if (chargesEnabled !== tenant.stripeChargesEnabled) {
    await prisma.restaurant.update({
      where: { id: tenant.id },
      data: { stripeChargesEnabled: chargesEnabled },
    });
  }

  return NextResponse.json({
    chargesEnabled,
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    accountId: tenant.stripeAccountId,
  });
}
