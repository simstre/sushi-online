import { notFound } from "next/navigation";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { WelcomeBanner } from "../welcome-banner";
import { PickupHeader } from "./pickup-header";

export const dynamic = "force-dynamic";

/**
 * Storefront chrome for /menu/* — focused per the foodTemplate design:
 * pickup header above the menu, optional tenant welcome message just
 * under it, then straight into the menu.
 *
 * The richer TenantInfo block (hours, map, socials) intentionally lives
 * elsewhere — it's noise above the items. The banner image is gone for
 * the same reason.
 */
export default async function MenuLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  return (
    <>
      <PickupHeader
        waitTimeMinutes={tenant.waitTimeMinutes}
        address={tenant.address}
        minOrder={tenant.minOrder}
        currency={tenant.currency}
      />
      <WelcomeBanner
        title={tenant.welcomeMessageTitle}
        body={tenant.welcomeMessageBody}
      />
      {children}
    </>
  );
}
