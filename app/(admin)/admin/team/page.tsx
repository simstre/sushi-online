import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { TeamList } from "./team-list";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  const members = await prisma.restaurantMember.findMany({
    where: { restaurantId: tenant.id },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  const pending = members.filter((m) => m.status === "pending");
  const active = members.filter((m) => m.status === "active");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve owner/staff access requests and manage existing members.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pending requests ({pending.length})
        </h2>
        <TeamList
          members={pending.map((m) => ({
            id: m.id,
            email: m.user.email,
            name: m.user.name,
            role: m.role,
            status: m.status,
            createdAt: m.createdAt.toISOString(),
          }))}
          variant="pending"
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active members ({active.length})
        </h2>
        <TeamList
          members={active.map((m) => ({
            id: m.id,
            email: m.user.email,
            name: m.user.name,
            role: m.role,
            status: m.status,
            createdAt: m.createdAt.toISOString(),
          }))}
          variant="active"
        />
      </section>
    </div>
  );
}
