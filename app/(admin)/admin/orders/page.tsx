import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { formatMoney } from "@/lib/utils";
import { OrderStatusSelect } from "./status-select";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [orders, stats] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: { restaurantId: tenant.id, createdAt: { gte: since } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
  ]);

  const paidStats = stats.find((s) => s.status === "paid");
  const revenue = paidStats?._sum.totalAmount ?? 0;
  const paidCount = paidStats?._count._all ?? 0;
  const aov = paidCount > 0 ? Math.round(revenue / paidCount) : 0;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-3 gap-3">
        <Stat label="Revenue (30d)" value={formatMoney(revenue, tenant.currency)} />
        <Stat label="Paid orders (30d)" value={paidCount.toString()} />
        <Stat label="Avg order value" value={formatMoney(aov, tenant.currency)} />
      </section>

      <section className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Orders</h1>
        <a
          href="/api/admin/export"
          className="text-sm underline"
          rel="noopener noreferrer"
        >
          Export CSV
        </a>
      </section>

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-3 py-2">{o.createdAt.toLocaleString()}</td>
                <td className="px-3 py-2">
                  {o.customerName}
                  <br />
                  <span className="text-muted-foreground">{o.customerPhone}</span>
                </td>
                <td className="px-3 py-2">{formatMoney(o.totalAmount, tenant.currency)}</td>
                <td className="px-3 py-2">
                  <OrderStatusSelect orderId={o.id} status={o.status} />
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-muted-foreground" colSpan={4}>
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
