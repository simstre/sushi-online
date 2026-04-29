import { prisma } from "@/lib/db/prisma";
import { NewUserForm } from "./new-user-form";

export const dynamic = "force-dynamic";

export default async function NewUserPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurantId?: string }>;
}) {
  const { restaurantId } = await searchParams;
  const restaurants = await prisma.restaurant.findMany({
    orderBy: [{ name: "asc" }, { locationName: "asc" }],
    select: { id: true, name: true, locationName: true, slug: true },
    take: 500,
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invite user</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sends an invite email with a &ldquo;Create your password&rdquo; link. Optionally grants
          admin or staff access to a restaurant.
        </p>
      </div>
      <NewUserForm
        initialRestaurantId={restaurantId ?? ""}
        restaurants={restaurants.map((r) => ({
          id: r.id,
          label: r.locationName ? `${r.name} — ${r.locationName}` : r.name,
          slug: r.slug,
        }))}
      />
    </div>
  );
}
