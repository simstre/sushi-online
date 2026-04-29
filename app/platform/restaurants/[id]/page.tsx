import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { displayTenantName } from "@/lib/tenant/display";
import { storefrontUrl } from "@/lib/tenant/url";
import { RestaurantControls } from "./restaurant-controls";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function PlatformRestaurantDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!restaurant) notFound();

  const last30 = new Date(Date.now() - 30 * DAY_MS);

  const [paidAllTime, paidLast30, statusCounts, members, recentOrders, ordersTotal] =
    await Promise.all([
      prisma.order.aggregate({
        where: { restaurantId: id, status: "paid" },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { restaurantId: id, status: "paid", createdAt: { gte: last30 } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: { restaurantId: id },
        _count: { _all: true },
      }),
      prisma.restaurantMember.findMany({
        where: { restaurantId: id },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      }),
      prisma.order.findMany({
        where: { restaurantId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          totalAmount: true,
          customerName: true,
          customerEmail: true,
          createdAt: true,
        },
      }),
      prisma.order.count({ where: { restaurantId: id } }),
    ]);

  const statusMap = statusCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const allTimeRevenue = paidAllTime._sum.totalAmount ?? 0;
  const allTimeCount = paidAllTime._count;
  const last30Revenue = paidLast30._sum.totalAmount ?? 0;
  const last30Count = paidLast30._count;
  const aov = last30Count > 0 ? Math.round(last30Revenue / last30Count) : 0;


  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/platform/restaurants"
            className="text-xs text-muted-foreground underline"
          >
            ← All restaurants
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{displayTenantName(restaurant)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{restaurant.slug}</span>
            {restaurant.brand && (
              <>
                {" · "}
                Brand:{" "}
                <Link href={`/platform/restaurants?q=${encodeURIComponent(restaurant.brand.name)}`} className="underline">
                  {restaurant.brand.name}
                </Link>
              </>
            )}
            {" · created "}
            {restaurant.createdAt.toLocaleDateString()}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {restaurant.inactive ? (
              <Badge variant="warn">Inactive</Badge>
            ) : (
              <Badge variant="ok">Active</Badge>
            )}
            {restaurant.orderOpen ? (
              <Badge variant="ok">Ordering open</Badge>
            ) : (
              <Badge variant="warn">Ordering closed</Badge>
            )}
            {restaurant.stripeAccountId && <Badge variant="info">Stripe Connect</Badge>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-sm">
          <div className="flex gap-3">
            <a
              href={storefrontUrl(restaurant.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Storefront ↗
            </a>
            <a
              href={storefrontUrl(restaurant.slug, "/admin/orders")}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Admin ↗
            </a>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Revenue (all time)"
          value={formatMoney(allTimeRevenue, restaurant.currency)}
          sub={`${allTimeCount} paid order${allTimeCount === 1 ? "" : "s"}`}
        />
        <Stat
          label="Revenue (30d)"
          value={formatMoney(last30Revenue, restaurant.currency)}
          sub={`${last30Count} paid`}
        />
        <Stat
          label="AOV (30d)"
          value={formatMoney(aov, restaurant.currency)}
          sub={last30Count === 0 ? "no paid orders" : undefined}
        />
        <Stat
          label="Order status"
          value={(ordersTotal).toString()}
          sub={`${statusMap.paid ?? 0} paid · ${statusMap.pending ?? 0} pending · ${statusMap.failed ?? 0} failed`}
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Operations
        </h2>
        <div className="mt-3 rounded-md border border-border bg-background p-4">
          <RestaurantControls
            restaurantId={restaurant.id}
            inactive={restaurant.inactive}
            orderOpen={restaurant.orderOpen}
            hasOrders={ordersTotal > 0}
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Members ({members.length})
          </h2>
          <Link
            href={`/platform/users/new?restaurantId=${restaurant.id}`}
            className="text-xs underline"
          >
            Invite member
          </Link>
        </div>
        {members.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/platform/users/${m.user.id}`} className="underline">
                        {m.user.email}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{m.user.name ?? "—"}</td>
                    <td className="px-3 py-2">{m.role}</td>
                    <td className="px-3 py-2">
                      {m.status === "pending" ? (
                        <Badge variant="warn">pending</Badge>
                      ) : (
                        <Badge variant="ok">active</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {m.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent orders
          </h2>
          <Link
            href={`/platform/orders?restaurantId=${restaurant.id}`}
            className="text-xs underline"
          >
            View all
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/platform/orders/${o.id}`} className="underline">
                        #{o.id.slice(-8)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div>{o.customerName}</div>
                      {o.customerEmail && (
                        <div className="text-xs text-muted-foreground">{o.customerEmail}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={o.status === "paid" ? "ok" : o.status === "pending" ? "info" : "warn"}>
                        {o.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(o.totalAmount, restaurant.currency)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {o.createdAt.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Badge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "ok" | "warn" | "info";
}) {
  const cls =
    variant === "ok"
      ? "bg-emerald-50 text-emerald-700"
      : variant === "warn"
        ? "bg-amber-50 text-amber-700"
        : "bg-sky-50 text-sky-700";
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}
