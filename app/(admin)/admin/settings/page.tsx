import { notFound } from "next/navigation";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { isTenantOwner } from "@/lib/auth/require";
import { SettingsForm } from "./settings-form";
import { StripeConnect } from "./stripe-connect";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  // Only owners (admin role + superadmin) see the Stripe Connect controls.
  // Staff can still view the rest of settings.
  const owner = await isTenantOwner(tenant.id);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Settings</h1>

      {owner && (
        <section className="rounded-lg border border-border bg-background p-5">
          <header className="mb-4">
            <h2 className="text-base font-semibold">Payments · Stripe</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect this restaurant&apos;s Stripe account so card payments and payouts go
              directly to your bank.
            </p>
          </header>
          <StripeConnect
            hasAccount={Boolean(tenant.stripeAccountId)}
            chargesEnabled={tenant.stripeChargesEnabled}
          />
        </section>
      )}

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
