import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { getOrCreateStripeCustomer } from "@/lib/stripe/customer";
import { requireUser } from "@/lib/auth/require";

export const runtime = "nodejs";

/** Detach a saved card from the current user's Stripe customer. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const customerId = await getOrCreateStripeCustomer(gate.id);

  // Verify ownership before detach.
  const pm = await stripe.paymentMethods.retrieve(id);
  if (pm.customer !== customerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await stripe.paymentMethods.detach(id);
  return NextResponse.json({ ok: true });
}

/** Mark a card as default. */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const customerId = await getOrCreateStripeCustomer(gate.id);

  const pm = await stripe.paymentMethods.retrieve(id);
  if (pm.customer !== customerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: id },
  });
  return NextResponse.json({ ok: true });
}
