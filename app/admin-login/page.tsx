import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/require";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { displayTenantName } from "@/lib/tenant/display";
import { AdminAuthForm } from "./admin-auth-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  const { callbackUrl } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(callbackUrl ?? "/admin/orders");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold">{displayTenantName(tenant)} · Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Restricted to restaurant owners and staff.
      </p>
      <AdminAuthForm callbackUrl={callbackUrl ?? "/admin/orders"} />
    </main>
  );
}
