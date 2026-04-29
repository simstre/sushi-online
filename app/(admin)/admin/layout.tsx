import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { displayTenantName } from "@/lib/tenant/display";
import { tenantHref } from "@/lib/tenant/url";
import {
  getCurrentUser,
  getTenantMembershipState,
  isTenantOwner,
} from "@/lib/auth/require";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  const user = await getCurrentUser();
  if (!user) {
    const callbackUrl = await tenantHref("/admin/orders");
    redirect(
      (await tenantHref("/admin-login")) +
        `?callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );
  }

  const state = await getTenantMembershipState(tenant.id);

  const navHrefs = {
    home: await tenantHref("/admin/dashboard"),
    orders: await tenantHref("/admin/orders"),
    dashboard: await tenantHref("/admin/dashboard"),
    menu: await tenantHref("/admin/menu"),
    team: await tenantHref("/admin/team"),
    settings: await tenantHref("/admin/settings"),
  };

  if (state === "pending") {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Pending approval</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are signed in as <strong>{user.email}</strong>. Your access request for{" "}
          {displayTenantName(tenant)} is awaiting review by an existing admin.
        </p>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </main>
    );
  }

  if (state === "none") {
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

  const owner = await isTenantOwner(tenant.id);

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href={owner ? navHrefs.dashboard : navHrefs.orders}
            className="font-semibold"
          >
            {displayTenantName(tenant)} · Admin
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {owner && (
              <Link href={navHrefs.dashboard} className="hover:underline">
                Dashboard
              </Link>
            )}
            <Link href={navHrefs.orders} className="hover:underline">
              Orders
            </Link>
            <Link href={navHrefs.menu} className="hover:underline">
              Menu
            </Link>
            <Link href={navHrefs.team} className="hover:underline">
              Team
            </Link>
            <Link href={navHrefs.settings} className="hover:underline">
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
