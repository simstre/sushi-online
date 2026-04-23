import { notFound } from "next/navigation";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { tenantBannerUrl } from "@/lib/tenant/display";
import { TenantInfo } from "../tenant-info";
import { WelcomeBanner } from "../welcome-banner";

export const dynamic = "force-dynamic";

/**
 * Storefront chrome (banner, welcome notice, address/map/hours) shows on
 * /menu/* only. Transactional pages (/cart, /checkout, /account, /confirmation)
 * inherit just the header from the tenant layout.
 */
export default async function MenuLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tenantBannerUrl(tenant)}
        alt=""
        className="mt-4 h-32 w-full rounded-lg object-cover md:mt-6 md:h-56"
      />
      <WelcomeBanner
        title={tenant.welcomeMessageTitle}
        body={tenant.welcomeMessageBody}
      />
      <TenantInfo
        tenant={{
          address: tenant.address,
          phone: tenant.phone,
          businessHours: tenant.businessHours,
          googleMapsUrl: tenant.googleMapsUrl,
          socials: tenant.socials,
        }}
      />
      {children}
    </>
  );
}
