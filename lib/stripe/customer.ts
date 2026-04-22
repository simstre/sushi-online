import { prisma } from "@/lib/db/prisma";
import { stripe } from "./client";

/**
 * Get or lazily create a Stripe Customer for a user. Saved cards live on the
 * platform account; tenant Connect-account checkouts don't get saved cards
 * (cross-account payment method sharing is out of scope).
 */
export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  });
  if (!user) throw new Error(`User ${userId} not found`);
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}
