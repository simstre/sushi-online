import Link from "next/link";
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
      <div className="mx-auto max-w-md py-12 text-center">
        <h1 className="text-2xl font-semibold">Thanks!</h1>
        <p className="mt-2 text-muted-foreground">
          We couldn&apos;t locate your order. Please contact the restaurant if you were charged.
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

  return (
    <div className="mx-auto max-w-xl space-y-4 py-4 md:py-6">
      <h1 className="text-2xl font-semibold">Order confirmed</h1>
      <p className="text-muted-foreground">
        Thanks, {order.customerName}. Your order at {displayTenantName(order.restaurant)} has been received.
      </p>
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">Order #{order.id.slice(-8)}</p>
        <p className="mt-1 text-sm">Status: {order.status}</p>
        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {order.items.map((it) => {
            const modsLine = renderOrderModifiers(it.modifiers);
            return (
              <li key={it.id} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span>
                    <span className="tabular-nums">{it.quantity}×</span>{" "}
                    {nameById.get(it.menuItemId) ?? "Item"}
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(it.price * it.quantity, order.restaurant.currency)}
                  </span>
                </div>
                {modsLine && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{modsLine}</p>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 border-t border-border pt-3 text-sm font-semibold">
          Total: {formatMoney(order.totalAmount, order.restaurant.currency)}
        </p>
      </div>
      <Link href="/menu" className="inline-block underline">
        Order again
      </Link>
    </div>
  );
}
