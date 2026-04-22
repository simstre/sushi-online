import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { getOrCreateStripeCustomer } from "@/lib/stripe/customer";
import { requireUser } from "@/lib/auth/require";

export const runtime = "nodejs";

function errorResponse(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[payment-methods]", message);
  return NextResponse.json({ error: message }, { status });
}

/** List saved cards for the current user. */
export async function GET() {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  try {
    const customerId = await getOrCreateStripeCustomer(gate.id);
    const methods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 20,
    });

    const customer = await stripe.customers.retrieve(customerId);
    const defaultPmId =
      customer && !("deleted" in customer)
        ? (customer.invoice_settings?.default_payment_method as string | null) ?? null
        : null;

    return NextResponse.json({
      paymentMethods: methods.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand ?? "card",
        last4: pm.card?.last4 ?? "",
        expMonth: pm.card?.exp_month ?? null,
        expYear: pm.card?.exp_year ?? null,
        isDefault: pm.id === defaultPmId,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Begin "Add card" flow by creating a SetupIntent; returns clientSecret. */
export async function POST() {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  try {
    const customerId = await getOrCreateStripeCustomer(gate.id);
    const intent = await stripe.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      usage: "off_session",
      metadata: { userId: gate.id },
    });
    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (err) {
    return errorResponse(err);
  }
}
