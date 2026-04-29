import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/db/prisma";
import { sendOrderReceiptEmail } from "@/lib/email";
import { displayTenantName } from "@/lib/tenant/display";
import { storefrontUrl } from "@/lib/tenant/url";

export const runtime = "nodejs";

async function sendReceiptForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, restaurant: true, user: { select: { email: true } } },
  });
  if (!order) return;

  const to = order.customerEmail ?? order.user?.email ?? null;
  if (!to) {
    console.warn(`[receipt] order ${orderId} has no email — skipping`);
    return;
  }

  const itemNames = await prisma.menuItem.findMany({
    where: { id: { in: order.items.map((i) => i.menuItemId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(itemNames.map((m) => [m.id, m.name]));

  const orderUrl = storefrontUrl(
    order.restaurant.slug,
    `/confirmation?orderId=${order.id}`,
  );

  await sendOrderReceiptEmail({
    to,
    customerName: order.customerName,
    restaurantName: displayTenantName(order.restaurant),
    orderId: order.id,
    currency: order.restaurant.currency,
    totalAmount: order.totalAmount,
    items: order.items.map((it) => ({
      name: nameById.get(it.menuItemId) ?? "Item",
      quantity: it.quantity,
      unitPrice: it.price,
      modifiers: it.modifiers,
    })),
    orderUrl,
  });
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: `Invalid signature: ${msg}` }, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = intent.metadata.orderId;
      if (orderId) {
        // updateMany + status filter makes the transition idempotent: only the
        // first webhook delivery flips pending→paid and triggers the receipt.
        const flipped = await prisma.order.updateMany({
          where: { id: orderId, status: { not: "paid" } },
          data: { status: "paid" },
        });
        await prisma.payment.update({
          where: { orderId },
          data: { status: intent.status },
        });
        if (flipped.count > 0) {
          try {
            await sendReceiptForOrder(orderId);
          } catch (err) {
            console.error(`[receipt] failed to send for order ${orderId}:`, err);
          }
        }
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = intent.metadata.orderId;
      if (orderId) {
        await prisma.$transaction([
          prisma.order.update({ where: { id: orderId }, data: { status: "failed" } }),
          prisma.payment.update({
            where: { orderId },
            data: { status: intent.status },
          }),
        ]);
      }
      break;
    }
    case "account.updated": {
      // Connected account changed — sync charges_enabled so the admin UI can
      // surface "Stripe ready" vs "Stripe pending" without manual refresh.
      const account = event.data.object as Stripe.Account;
      await prisma.restaurant.updateMany({
        where: { stripeAccountId: account.id },
        data: { stripeChargesEnabled: Boolean(account.charges_enabled) },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
