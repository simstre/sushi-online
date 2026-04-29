import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { isTenantOwner } from "@/lib/auth/require";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { LogoutButton } from "../logout-button";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function AdminDashboardPage() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  const owner = await isTenantOwner(tenant.id);
  if (!owner) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Owner access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Financial dashboards are visible to restaurant owners and platform admins only.
        </p>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </main>
    );
  }

  const now = new Date();
  const today = startOfDay(now);
  const last7 = new Date(today.getTime() - 6 * DAY_MS); // includes today → 7 buckets
  const last30 = new Date(today.getTime() - 29 * DAY_MS);

  const [
    paidAllTime,
    paidLast30,
    countsLast30,
    paidLast7,
    pendingNow,
    failedLast30,
    topItems,
    recentPaid,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { restaurantId: tenant.id, status: "paid" },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { restaurantId: tenant.id, status: "paid", createdAt: { gte: last30 } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: { restaurantId: tenant.id, createdAt: { gte: last30 } },
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: { restaurantId: tenant.id, status: "paid", createdAt: { gte: last7 } },
      select: { totalAmount: true, createdAt: true },
    }),
    prisma.order.count({
      where: { restaurantId: tenant.id, status: "pending" },
    }),
    prisma.order.count({
      where: { restaurantId: tenant.id, status: "failed", createdAt: { gte: last30 } },
    }),
    prisma.$queryRaw<Array<{ menuItemId: string; qty: bigint; revenue: bigint }>>`
      SELECT oi."menuItemId", SUM(oi.quantity)::bigint AS qty, SUM(oi.quantity * oi.price)::bigint AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."restaurantId" = ${tenant.id}
        AND o.status = 'paid'
        AND o."createdAt" >= ${last30}
      GROUP BY oi."menuItemId"
      ORDER BY qty DESC
      LIMIT 10
    `,
    prisma.order.findMany({
      where: { restaurantId: tenant.id, status: "paid" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        totalAmount: true,
        customerName: true,
      },
    }),
  ]);

  const allTimeRevenue = paidAllTime._sum.totalAmount ?? 0;
  const allTimeCount = paidAllTime._count;
  const last30Revenue = paidLast30._sum.totalAmount ?? 0;
  const last30Count = paidLast30._count;
  const aov = last30Count > 0 ? Math.round(last30Revenue / last30Count) : 0;

  // Bucket last7 paid orders by day.
  const dailyMap = new Map<string, { count: number; revenue: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(last7.getTime() + i * DAY_MS);
    dailyMap.set(dayKey(d), { count: 0, revenue: 0 });
  }
  for (const o of paidLast7) {
    const key = dayKey(startOfDay(o.createdAt));
    const bucket = dailyMap.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.revenue += o.totalAmount;
    }
  }
  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({ key, ...v }));

  // Top items: hydrate names.
  const itemNames = await prisma.menuItem.findMany({
    where: { id: { in: topItems.map((t) => t.menuItemId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(itemNames.map((m) => [m.id, m.name]));

  const statusBreakdown = countsLast30.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const currency = tenant.currency;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Business and financial overview for the last 30 days.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Revenue (all time)"
          value={formatMoney(allTimeRevenue, currency)}
          sub={`${allTimeCount} paid order${allTimeCount === 1 ? "" : "s"}`}
        />
        <Stat
          label="Revenue (30d)"
          value={formatMoney(last30Revenue, currency)}
          sub={`${last30Count} paid`}
        />
        <Stat
          label="Avg order value (30d)"
          value={formatMoney(aov, currency)}
          sub={last30Count === 0 ? "no paid orders" : undefined}
        />
        <Stat
          label="Open orders"
          value={pendingNow.toString()}
          sub={`${failedLast30} failed (30d)`}
        />
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Last 7 days
        </h2>
        <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Paid orders</th>
                <th className="px-3 py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.key} className="border-t border-border">
                  <td className="px-3 py-2">
                    {new Date(d.key).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(d.revenue, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Top items (30d)
        </h2>
        {topItems.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No paid orders in the last 30 days.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-right">Qty sold</th>
                  <th className="px-3 py-2 text-right">Line revenue</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((t) => (
                  <tr key={t.menuItemId} className="border-t border-border">
                    <td className="px-3 py-2">{nameById.get(t.menuItemId) ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(t.qty)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(Number(t.revenue), currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Order status (30d)
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {(["paid", "pending", "failed"] as const).map((s) => (
              <li key={s} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                <span className="capitalize">{s}</span>
                <span className="font-medium tabular-nums">{statusBreakdown[s] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent paid orders
          </h2>
          {recentPaid.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No paid orders yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {recentPaid.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{o.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      #{o.id.slice(-8)} · {o.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <span className="tabular-nums">
                    {formatMoney(o.totalAmount, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
