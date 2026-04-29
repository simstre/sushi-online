import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { displayTenantName } from "@/lib/tenant/display";
import { renderOrderModifiers } from "@/lib/order/modifiers";

export const dynamic = "force-dynamic";

export default async function PlatformOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      restaurant: { select: { id: true, name: true, locationName: true, currency: true, slug: true } },
      user: { select: { id: true, email: true, name: true } },
      items: true,
      payment: true,
    },
  });
  if (!order) notFound();

  const itemNames = await prisma.menuItem.findMany({
    where: { id: { in: order.items.map((i) => i.menuItemId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(itemNames.map((m) => [m.id, m.name]));

  const currency = order.restaurant.currency;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/platform/orders" className="text-xs text-muted-foreground underline">
          ← All orders
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Order #{order.id.slice(-8)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {order.createdAt.toLocaleString()} ·{" "}
          <Link href={`/platform/restaurants/${order.restaurant.id}`} className="underline">
            {displayTenantName(order.restaurant)}
          </Link>
        </p>
        <div className="mt-2">
          <span
            className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${
              order.status === "paid"
                ? "bg-emerald-50 text-emerald-700"
                : order.status === "pending"
                  ? "bg-sky-50 text-sky-700"
                  : "bg-amber-50 text-amber-700"
            }`}
          >
            {order.status}
          </span>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Total" value={formatMoney(order.totalAmount, currency)} />
        <Stat label="Items" value={order.items.reduce((s, i) => s + i.quantity, 0).toString()} />
        <Stat label="Payment status" value={order.payment?.status ?? "—"} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Customer
          </h2>
          <div className="mt-3 space-y-1 rounded-md border border-border bg-background p-4 text-sm">
            <p className="font-medium">{order.customerName}</p>
            {order.customerEmail && (
              <p className="text-muted-foreground">{order.customerEmail}</p>
            )}
            {order.customerPhone && (
              <p className="text-muted-foreground">{order.customerPhone}</p>
            )}
            {order.user ? (
              <p className="text-xs text-muted-foreground">
                Account:{" "}
                <Link href={`/platform/users/${order.user.id}`} className="underline">
                  {order.user.email}
                </Link>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Guest checkout</p>
            )}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Payment
          </h2>
          <div className="mt-3 space-y-1 rounded-md border border-border bg-background p-4 text-sm">
            {order.payment ? (
              <>
                <p className="font-mono text-xs">{order.payment.stripePaymentIntentId}</p>
                <p className="text-muted-foreground">Status: {order.payment.status}</p>
              </>
            ) : (
              <p className="text-muted-foreground">No payment record.</p>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Items
        </h2>
        <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Line</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => {
                const mods = renderOrderModifiers(it.modifiers);
                return (
                  <tr key={it.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <div>{nameById.get(it.menuItemId) ?? "Item"}</div>
                      {mods && (
                        <div className="text-xs text-muted-foreground">{mods}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(it.price, currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(it.price * it.quantity, currency)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-border bg-muted/20">
                <td className="px-3 py-2 text-right font-semibold" colSpan={3}>
                  Total
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {formatMoney(order.totalAmount, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
