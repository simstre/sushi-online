import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/require";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { formatMoney } from "@/lib/utils";
import { ProfileForm } from "./profile-form";
import { PaymentMethods } from "./payment-methods";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/account");

  const [full, orders] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { userId: user.id, restaurantId: tenant.id },
      orderBy: { createdAt: "desc" },
      include: { items: true },
      take: 50,
    }),
  ]);

  if (!full) notFound();

  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Signed in as {full.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
        {/* Left: profile + payment methods */}
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold">Personal info</h2>
            <ProfileForm profile={{ name: full.name ?? "", email: full.email }} />
          </section>

          <PaymentMethods />
        </div>

        {/* Right: order history */}
        <section>
          <h2 className="text-xl font-semibold">Previous Orders</h2>
          {orders.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No orders yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Order #{o.id.slice(-8)}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.createdAt.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill status={o.status} />
                      <span className="text-sm font-semibold">
                        {formatMoney(o.totalAmount, tenant.currency)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {o.items.reduce((sum, i) => sum + i.quantity, 0)} item
                    {o.items.length === 1 ? "" : "s"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "paid" || status === "completed" || status === "ready"
      ? "bg-green-50 text-green-700"
      : status === "failed" || status === "cancelled"
        ? "bg-red-50 text-red-700"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${color}`}>
      {status}
    </span>
  );
}
