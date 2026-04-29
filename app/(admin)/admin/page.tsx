import { redirect } from "next/navigation";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { isTenantOwner } from "@/lib/auth/require";
import { tenantHref } from "@/lib/tenant/url";

export default async function AdminIndex() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) redirect(await tenantHref("/admin/orders"));
  const owner = await isTenantOwner(tenant.id);
  redirect(await tenantHref(owner ? "/admin/dashboard" : "/admin/orders"));
}
