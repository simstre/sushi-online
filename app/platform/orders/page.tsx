import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { displayTenantName } from "@/lib/tenant/display";

export const dynamic = "force-dynamic";

const STATUSES = ["paid", "pending", "failed"] as const;

export default async function PlatformOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    restaurantId?: string;
  }>;
}) {
  const { q, status, restaurantId } = await searchParams;
  const query = (q ?? "").trim();
  const statusFilter = STATUSES.includes(status as (typeof STATUSES)[number])
    ? (status as (typeof STATUSES)[number])
    : null;

  const where = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(restaurantId ? { restaurantId } : {}),
    ...(query
      ? {
          OR: [
            { customerName: { contains: query, mode: "insensitive" as const } },
            { customerEmail: { contains: query, mode: "insensitive" as const } },
            { customerPhone: { contains: query, mode: "insensitive" as const } },
            { id: { equals: query } },
          ],
        }
      : {}),
  };

  const [orders, focusedRestaurant] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        restaurant: { select: { id: true, name: true, locationName: true, currency: true } },
      },
    }),
    restaurantId
      ? prisma.restaurant.findUnique({
          where: { id: restaurantId },
          select: { id: true, name: true, locationName: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {focusedRestaurant ? (
            <>
              Showing orders for{" "}
              <strong>{displayTenantName(focusedRestaurant)}</strong>.{" "}
              <Link href="/platform/orders" className="underline">
                Clear filter
              </Link>
            </>
          ) : (
            <>Cross-tenant order feed. Most recent first.</>
          )}
        </p>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-2">
        {restaurantId && <input type="hidden" name="restaurantId" value={restaurantId} />}
        <label className="block text-sm">
          <span className="block text-xs text-muted-foreground">Search</span>
          <Input
            name="q"
            defaultValue={query}
            placeholder="Customer, email, phone, or order id"
            className="mt-1 w-72"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-xs text-muted-foreground">Status</span>
          <select
            name="status"
            defaultValue={statusFilter ?? ""}
            className="mt-1 flex h-10 w-40 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        {(query || statusFilter) && (
          <Link
            href={
              restaurantId
                ? `/platform/orders?restaurantId=${restaurantId}`
                : "/platform/orders"
            }
          >
            <Button type="button" variant="ghost">
              Clear
            </Button>
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Restaurant</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">When</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/platform/orders/${o.id}`} className="underline">
                    #{o.id.slice(-8)}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/platform/restaurants/${o.restaurant.id}`}
                    className="hover:underline"
                  >
                    {displayTenantName(o.restaurant)}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <div>{o.customerName}</div>
                  {o.customerEmail && (
                    <div className="text-xs text-muted-foreground">{o.customerEmail}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      o.status === "paid"
                        ? "bg-emerald-50 text-emerald-700"
                        : o.status === "pending"
                          ? "bg-sky-50 text-sky-700"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMoney(o.totalAmount, o.restaurant.currency)}
                </td>
                <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                  {o.createdAt.toLocaleString()}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-muted-foreground">
                  No orders match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {orders.length === 100 && (
        <p className="text-xs text-muted-foreground">
          Showing the 100 most recent matches. Refine the filters to see more.
        </p>
      )}
    </div>
  );
}
