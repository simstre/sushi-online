import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/require";
import { LogoutButton } from "../(admin)/admin/logout-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Platform admin · sushi-online",
};

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/platform");

  if (!user.isSuperAdmin) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">No access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;re signed in as <strong>{user.email}</strong> but don&apos;t have
          platform-admin privileges.
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
          <Link href="/platform" className="font-semibold">
            sushi-online <span className="text-muted-foreground">· Platform Admin</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/platform" className="hover:underline">
              Dashboard
            </Link>
            <Link href="/platform/restaurants" className="hover:underline">
              Restaurants
            </Link>
            <Link href="/platform/users" className="hover:underline">
              Users
            </Link>
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
    </div>
  );
}
