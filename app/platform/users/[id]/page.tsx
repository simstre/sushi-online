import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/require";
import { displayTenantName } from "@/lib/tenant/display";
import { UserActions } from "./user-actions";

export const dynamic = "force-dynamic";

export default async function PlatformUserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getCurrentUser();

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          restaurant: { select: { id: true, name: true, locationName: true, currency: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user) notFound();

  const [orderAgg, recentOrders, resetTokens] = await Promise.all([
    prisma.order.aggregate({
      where: { userId: id, status: "paid" },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.order.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { restaurant: { select: { name: true, locationName: true, currency: true, slug: true } } },
    }),
    prisma.passwordResetToken.findMany({
      where: { userId: id, usedAt: null, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { createdAt: true, expiresAt: true },
    }),
  ]);

  const lifetimeSpend = orderAgg._sum.totalAmount ?? 0;
  const orderCount = orderAgg._count;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/platform/users" className="text-xs text-muted-foreground underline">
          ← All users
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{user.name ?? user.email}</h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{user.email}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium">
          {user.isSuperAdmin && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">Superadmin</span>
          )}
          {user.memberships.length > 0 && (
            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">
              Tenant member ({user.memberships.length})
            </span>
          )}
          {user.memberships.length === 0 && !user.isSuperAdmin && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">Customer</span>
          )}
          {!user.passwordHash && (
            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">No password set</span>
          )}
          {resetTokens.length > 0 && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
              Reset link active (expires {resetTokens[0].expiresAt.toLocaleString()})
            </span>
          )}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Lifetime spend (paid)" value={formatMoney(lifetimeSpend)} />
        <Stat label="Paid orders" value={orderCount.toString()} />
        <Stat label="Joined" value={user.createdAt.toLocaleDateString()} />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Actions
        </h2>
        <div className="mt-3 rounded-md border border-border bg-background p-4">
          <UserActions
            userId={user.id}
            email={user.email}
            isSuperAdmin={user.isSuperAdmin}
            isSelf={me?.id === user.id}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Memberships
        </h2>
        {user.memberships.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Not a member of any restaurant.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Restaurant</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Joined</th>
                </tr>
              </thead>
              <tbody>
                {user.memberships.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Link href={`/platform/restaurants/${m.restaurant.id}`} className="underline">
                        {displayTenantName(m.restaurant)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{m.role}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          m.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {m.status}
                      </span>
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent orders
        </h2>
        {recentOrders.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">Restaurant</th>
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
                    <td className="px-3 py-2">{displayTenantName(o.restaurant)}</td>
                    <td className="px-3 py-2">{o.status}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(o.totalAmount, o.restaurant.currency)}
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
