import { NewRestaurantForm } from "./new-restaurant-form";

export const dynamic = "force-dynamic";

export default function NewRestaurantPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New restaurant</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates a blank tenant. Use the import script for scraped-data tenants.
        </p>
      </div>
      <NewRestaurantForm />
    </div>
  );
}
