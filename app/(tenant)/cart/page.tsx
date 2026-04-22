import { notFound } from "next/navigation";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { CartView } from "./cart-view";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();
  return (
    <CartView
      currency={tenant.currency}
      minOrder={tenant.minOrder ?? 0}
    />
  );
}
