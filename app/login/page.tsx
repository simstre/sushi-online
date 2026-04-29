import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/require";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { tenantHref } from "@/lib/tenant/url";
import { isGoogleSsoEnabled } from "@/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const tenant = await getTenantFromHeaders();
  const user = await getCurrentUser();

  const defaultDest = tenant ? await tenantHref("/account") : "/platform";
  if (user) redirect(callbackUrl ?? defaultDest);

  if (!tenant) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
        <h1 className="text-2xl font-semibold">Platform admin sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Restricted to platform administrators.
        </p>
        <LoginForm callbackUrl={callbackUrl ?? "/platform"} />
      </main>
    );
  }

  const signupHref = await tenantHref("/signup");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Place orders faster and track your history.
      </p>
      <LoginForm callbackUrl={callbackUrl ?? defaultDest} showGoogle={isGoogleSsoEnabled} />
      <p className="mt-4 text-sm text-muted-foreground">
        New here?{" "}
        <Link href={signupHref} className="underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
