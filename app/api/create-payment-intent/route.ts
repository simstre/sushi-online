import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/client";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { getCurrentUser } from "@/lib/auth/require";
import { getOrCreateStripeCustomer } from "@/lib/stripe/customer";

const bodySchema = z.object({
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(3).max(40),
  items: z
    .array(z.object({ id: z.string().min(1), quantity: z.number().int().positive() }))
    .min(1),
});

export async function POST(req: Request) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) {
    return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  }

  const user = await getCurrentUser();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { customerName, customerPhone, items } = parsed.data;

  // Price items server-side — never trust client prices.
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((i) => i.id) }, isAvailable: true },
    include: { category: { include: { menu: true } } },
  });

  const priced = items.map((i) => {
    const m = menuItems.find((mi) => mi.id === i.id);
    if (!m) throw new Error(`Menu item ${i.id} not found`);
    if (m.category.menu.restaurantId !== tenant.id) {
      throw new Error(`Menu item ${i.id} does not belong to this restaurant`);
    }
    return { menuItemId: m.id, price: m.price, quantity: i.quantity };
  });

  const total = priced.reduce((sum, p) => sum + p.price * p.quantity, 0);
  if (total <= 0) {
    return NextResponse.json({ error: "Cart total must be positive" }, { status: 400 });
  }
  if (tenant.minOrder && total < tenant.minOrder) {
    return NextResponse.json(
      {
        error: `Minimum order is ${(tenant.minOrder / 100).toFixed(2)}; you have ${(total / 100).toFixed(2)}.`,
      },
      { status: 400 },
    );
  }

  const order = await prisma.order.create({
    data: {
      restaurantId: tenant.id,
      userId: user?.id ?? null,
      status: "pending",
      totalAmount: total,
      customerName,
      customerPhone,
      items: { create: priced },
    },
  });

  const intentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
    amount: total,
    currency: tenant.currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      orderId: order.id,
      restaurantId: tenant.id,
      userId: user?.id ?? "",
    },
  };

  // For direct-charge (non-Connect) tenants, attach the platform Stripe customer
  // so saved cards appear in PaymentElement and future charges stay on record.
  // Saved cards aren't reused across Connect accounts — skipping when stripeAccountId is set.
  if (user && !tenant.stripeAccountId) {
    intentParams.customer = await getOrCreateStripeCustomer(user.id);
    intentParams.setup_future_usage = "off_session";
  }

  // Stripe Connect: if the tenant has a connected account, route funds there.
  const requestOptions: Parameters<typeof stripe.paymentIntents.create>[1] = tenant.stripeAccountId
    ? { stripeAccount: tenant.stripeAccountId }
    : undefined;

  const intent = await stripe.paymentIntents.create(intentParams, requestOptions);

  await prisma.payment.create({
    data: {
      orderId: order.id,
      stripePaymentIntentId: intent.id,
      status: intent.status,
    },
  });

  return NextResponse.json({ clientSecret: intent.client_secret, orderId: order.id });
}
