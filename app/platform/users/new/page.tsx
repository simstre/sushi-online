import { prisma } from "@/lib/db/prisma";
import { NewUserForm } from "./new-user-form";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const restaurants = await prisma.restaurant.findMany({
    orderBy: [{ name: "asc" }, { locationName: "asc" }],
    select: { id: true, name: true, locationName: true, slug: true },
    take: 500,
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New user</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates an account and optionally links it as admin of a restaurant.
        </p>
      </div>
      <NewUserForm
        restaurants={restaurants.map((r) => ({
          id: r.id,
          label: r.locationName ? `${r.name} — ${r.locationName}` : r.name,
          slug: r.slug,
        }))}
      />
    </div>
  );
}
