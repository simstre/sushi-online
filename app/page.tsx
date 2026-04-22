import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { displayTenantName } from "@/lib/tenant/display";
import { getCurrentUser } from "@/lib/auth/require";
import { MOST_LIKED_SLUG } from "@/lib/fake-stats";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  // On a tenant subdomain, land directly on the Most Liked menu view.
  const tenant = await getTenantFromHeaders();
  if (tenant) redirect(`/menu/${MOST_LIKED_SLUG}`);

  const user = await getCurrentUser();

  const restaurants = await prisma.restaurant
    .findMany({ orderBy: { createdAt: "desc" }, take: 20 })
    .catch(() => [] as Awaited<ReturnType<typeof prisma.restaurant.findMany>>);

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const proto = rootDomain.startsWith("localhost") ? "http" : "https";

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">sushi-online</h1>
          <p className="mt-2 text-muted-foreground">
            Multi-tenant restaurant ordering platform. Each restaurant is served on its own
            subdomain.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-sm">
          {user?.isSuperAdmin ? (
            <Link href="/platform" className="underline">
              Platform admin →
            </Link>
          ) : user ? (
            <span className="text-muted-foreground">{user.email}</span>
          ) : (
            <Link href="/login" className="underline">
              Sign in
            </Link>
          )}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Restaurants</h2>
        {restaurants.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            None yet. Create one via <code>POST /api/admin/create-restaurant</code> or run{" "}
            <code>npm run db:seed</code>.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {restaurants.map((r) => (
              <li key={r.id}>
                <Link
                  className="underline"
                  href={`${proto}://${r.slug}.${rootDomain}/`}
                >
                  {displayTenantName(r)} — {r.slug}.{rootDomain}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
