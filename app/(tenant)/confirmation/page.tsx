import Link from "next/link";
import { Check } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { displayTenantName } from "@/lib/tenant/display";
import { formatMoney } from "@/lib/utils";
import { renderOrderModifiers } from "@/lib/order/modifiers";

export const dynamic = "force-dynamic";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  const order = orderId
    ? await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, restaurant: true },
      })
    : null;

  if (!order) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Thanks!</h1>
        <p className="mt-2 text-muted-foreground">
          We couldn&apos;t locate your order. Please contact the restaurant if you were
          charged.
        </p>
        <Link href="/menu" className="mt-4 inline-block underline">
          Back to menu
        </Link>
      </div>
    );
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: order.items.map((i) => i.menuItemId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(menuItems.map((m) => [m.id, m.name]));

  const restaurantName = displayTenantName(order.restaurant);
  const isPaid = order.status === "paid";

  return (
    <div className="mx-auto max-w-xl space-y-6 py-6 md:py-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Order #{order.id.slice(-8)}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          Thanks, {order.customerName} — your order is in.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {restaurantName} will start preparing it shortly.
        </p>
      </div>

      {/* Status banner */}
      <div
        className={
          isPaid
            ? "flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900"
            : "flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
        }
      >
        <span
          className={
            isPaid
              ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
              : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white"
          }
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
        <div className="text-sm">
          {isPaid ? (
            <>
              <strong>Confirmed.</strong> Your payment has been received.
            </>
          ) : (
            <>
              <strong>Order placed.</strong> Status: {order.status}
            </>
          )}
        </div>
      </div>

      {/* Order summary */}
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="border-b border-border px-4 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Order summary
          </p>
        </div>
        <ul className="divide-y divide-border">
          {order.items.map((it) => {
            const modsLine = renderOrderModifiers(it.modifiers);
            return (
              <li key={it.id} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p>
                      <span className="text-muted-foreground tabular-nums">
                        {it.quantity}×
                      </span>{" "}
                      <span className="font-medium">
                        {nameById.get(it.menuItemId) ?? "Item"}
                      </span>
                    </p>
                    {modsLine && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{modsLine}</p>
                    )}
                  </div>
                  <span className="shrink-0 tabular-nums">
                    {formatMoney(it.price * it.quantity, order.restaurant.currency)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between border-t-2 border-foreground bg-background px-4 py-3">
          <span className="text-lg font-semibold">Total</span>
          <span className="text-lg font-bold tabular-nums">
            {formatMoney(order.totalAmount, order.restaurant.currency)}
          </span>
        </div>
      </div>

      <Link href="/menu" className="inline-block underline">
        Order again
      </Link>
    </div>
  );
}
