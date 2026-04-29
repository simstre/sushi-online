import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function PlatformRestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { locationName: { contains: query, mode: "insensitive" as const } },
          { slug: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const restaurants = await prisma.restaurant.findMany({
    where,
    orderBy: [{ brandId: "asc" }, { locationName: "asc" }, { name: "asc" }],
    include: {
      brand: { select: { name: true } },
      _count: { select: { orders: true, members: true } },
    },
    take: 200,
  });

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const proto = rootDomain.startsWith("localhost") ? "http" : "https";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Restaurants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every tenant on the platform. Click a row to open that tenant&apos;s admin.
          </p>
        </div>
        <Link href="/platform/restaurants/new">
          <Button>New restaurant</Button>
        </Link>
      </div>

      <form method="GET" className="flex max-w-md gap-2">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search by brand, location, or slug"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {query && (
          <Link href="/platform/restaurants">
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
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Brand</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Orders</th>
              <th className="px-3 py-2 text-right">Admins</th>
              <th className="px-3 py-2">Links</th>
            </tr>
          </thead>
          <tbody>
            {restaurants.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Link
                    href={`/platform/restaurants/${r.id}`}
                    className="font-medium hover:underline"
                  >
                    {r.name}
                  </Link>
                  {r.locationName && (
                    <p className="text-xs text-muted-foreground">{r.locationName}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.brand?.name ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {r.slug}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {r.inactive ? (
                      <span className="inline-flex rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        Inactive
                      </span>
                    ) : (
                      <span className="inline-flex rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        Active
                      </span>
                    )}
                    {!r.orderOpen && (
                      <span className="inline-flex rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        Closed
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r._count.orders}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r._count.members}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-3 text-xs">
                    <Link href={`/platform/restaurants/${r.id}`} className="underline">
                      Manage
                    </Link>
                    <a
                      href={`${proto}://${r.slug}.${rootDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Storefront
                    </a>
                  </div>
                </td>
              </tr>
            ))}
            {restaurants.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">
                  No restaurants match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {restaurants.length === 200 && (
        <p className="text-xs text-muted-foreground">
          Showing first 200 results. Narrow the search to see more.
        </p>
      )}
    </div>
  );
}
