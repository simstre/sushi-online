import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlatformDashboard() {
  const [
    users,
    superadmins,
    brands,
    restaurants,
    activeTenants,
    paidOrders,
    paidRevenue,
    pendingOrders,
    recentRestaurants,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isSuperAdmin: true } }),
    prisma.brand.count(),
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { inactive: false, orderOpen: true } }),
    prisma.order.count({ where: { status: "paid" } }),
    prisma.order.aggregate({
      where: { status: "paid" },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.restaurant.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { brand: { select: { name: true } } },
    }),
  ]);

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const proto = rootDomain.startsWith("localhost") ? "http" : "https";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide overview. Tenant-specific admin lives at each restaurant&apos;s subdomain.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Stat label="Users" value={users.toString()} sub={`${superadmins} superadmin${superadmins === 1 ? "" : "s"}`} />
        <Stat label="Brands" value={brands.toString()} />
        <Stat
          label="Restaurants"
          value={restaurants.toString()}
          sub={`${activeTenants} active`}
        />
        <Stat label="Paid orders" value={paidOrders.toString()} />
        <Stat
          label="Processed payments"
          value={formatMoney(paidRevenue._sum.totalAmount ?? 0)}
          sub="across all tenants"
        />
      </div>

      {pendingOrders > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {pendingOrders} order{pendingOrders === 1 ? "" : "s"} currently pending across all tenants.
        </p>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recently added restaurants</h2>
          <Link href="/platform/restaurants" className="text-sm underline">
            View all
          </Link>
        </div>
        <ul className="mt-3 space-y-2">
          {recentRestaurants.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {r.name}
                  {r.locationName && (
                    <span className="text-muted-foreground"> — {r.locationName}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.brand?.name ?? "—"} · {r.createdAt.toLocaleDateString()}
                </p>
              </div>
              <a
                href={`${proto}://${r.slug}.${rootDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline"
              >
                Visit
              </a>
            </li>
          ))}
        </ul>
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
