import { CheckoutView } from "./checkout-view";
import { getCurrentUser } from "@/lib/auth/require";
import { tenantHref } from "@/lib/tenant/url";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await getCurrentUser();

  // Pre-compute tenant-aware auth URLs that bring the customer back to
  // /checkout after sign-in or signup. The cart is persisted to
  // localStorage (sushi-online-cart) so items survive the round-trip.
  const cb = encodeURIComponent(await tenantHref("/checkout"));
  const signupHref = `${await tenantHref("/signup")}?callbackUrl=${cb}`;
  const loginHref = `${await tenantHref("/login")}?callbackUrl=${cb}`;

  return (
    <CheckoutView
      initialName={user?.name ?? ""}
      initialEmail={user?.email ?? ""}
      isSignedIn={Boolean(user)}
      signupHref={signupHref}
      loginHref={loginHref}
    />
  );
}
