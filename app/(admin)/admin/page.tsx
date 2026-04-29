import { redirect } from "next/navigation";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { isTenantOwner } from "@/lib/auth/require";

export default async function AdminIndex() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) redirect("/admin/orders");
  const owner = await isTenantOwner(tenant.id);
  redirect(owner ? "/admin/dashboard" : "/admin/orders");
}
