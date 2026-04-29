import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserRowActions } from "./user-row-actions";

export const dynamic = "force-dynamic";

export default async function PlatformUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const where = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" as const } },
          { name: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      memberships: {
        include: { restaurant: { select: { slug: true, name: true, locationName: true } } },
      },
      _count: { select: { orders: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone with a sushi-online account: customers, restaurant admins, and superadmins.
          </p>
        </div>
        <Link href="/platform/users/new">
          <Button>Invite user</Button>
        </Link>
      </div>

      <form method="GET" className="flex max-w-md gap-2">
        <Input name="q" defaultValue={query} placeholder="Search by email or name" />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {query && (
          <Link href="/platform/users">
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
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Memberships</th>
              <th className="px-3 py-2 text-right">Orders</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border align-top">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/platform/users/${u.id}`} className="hover:underline">
                    {u.email}
                  </Link>
                </td>
                <td className="px-3 py-2">{u.name ?? "—"}</td>
                <td className="px-3 py-2">
                  {u.isSuperAdmin ? (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                      Superadmin
                    </span>
                  ) : u.memberships.length > 0 ? (
                    <span className="text-xs text-muted-foreground">Tenant admin</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Customer</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {u.memberships.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <ul className="text-xs">
                      {u.memberships.map((m) => (
                        <li key={m.id} className="truncate">
                          {m.restaurant.name}
                          {m.restaurant.locationName && ` — ${m.restaurant.locationName}`}
                          <span className="ml-1 text-muted-foreground">({m.role})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{u._count.orders}</td>
                <td className="px-3 py-2">
                  <UserRowActions
                    userId={u.id}
                    email={u.email}
                    isSuperAdmin={u.isSuperAdmin}
                  />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-muted-foreground">
                  No users match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
