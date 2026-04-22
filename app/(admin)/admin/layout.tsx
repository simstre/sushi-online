import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { displayTenantName } from "@/lib/tenant/display";
import { canAdminTenant, getCurrentUser } from "@/lib/auth/require";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=/admin/orders`);

  const ok = await canAdminTenant(tenant.id);
  if (!ok) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">No access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are signed in as <strong>{user.email}</strong> but do not have admin access to{" "}
          {displayTenantName(tenant)}.
        </p>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/admin/orders" className="font-semibold">
            {displayTenantName(tenant)} · Admin
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin/orders" className="hover:underline">
              Orders
            </Link>
            <Link href="/admin/menu" className="hover:underline">
              Menu
            </Link>
            <Link href="/admin/settings" className="hover:underline">
              Settings
            </Link>
            <span className="text-muted-foreground">{user.email}</span>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
