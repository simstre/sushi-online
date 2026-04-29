import { redirect } from "next/navigation";
import { MOST_LIKED_SLUG } from "@/lib/fake-stats";
import { tenantHref } from "@/lib/tenant/url";

export default async function MenuIndexPage() {
  redirect(await tenantHref(`/menu/${MOST_LIKED_SLUG}`));
}
