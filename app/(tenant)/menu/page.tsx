import { redirect } from "next/navigation";
import { MOST_LIKED_SLUG } from "@/lib/fake-stats";

export default function MenuIndexPage() {
  redirect(`/menu/${MOST_LIKED_SLUG}`);
}
