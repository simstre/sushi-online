import { CheckoutView } from "./checkout-view";
import { getCurrentUser } from "@/lib/auth/require";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  return <CheckoutView initialName={user?.name ?? ""} initialEmail={user?.email ?? ""} />;
}
