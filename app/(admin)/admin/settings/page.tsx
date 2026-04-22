import { notFound } from "next/navigation";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsForm
        tenant={{
          id: tenant.id,
          name: tenant.name,
          locationName: tenant.locationName,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl,
          bannerUrl: tenant.bannerUrl,
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          currency: tenant.currency,
          stripeAccountId: tenant.stripeAccountId,
          externalStripeAccountId: tenant.externalStripeAccountId,
          address: tenant.address,
          phone: tenant.phone,
          businessHours: tenant.businessHours,
        }}
      />
    </div>
  );
}
