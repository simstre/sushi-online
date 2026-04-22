import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { ensureDefaultMenu } from "@/lib/tenant/ensure-menu";
import { MenuEditor } from "./menu-editor";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  const menu = await ensureDefaultMenu(tenant.id);
  const categories = await prisma.menuCategory.findMany({
    where: { menuId: menu.id },
    orderBy: { order: "asc" },
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
  });

  return (
    <MenuEditor
      currency={tenant.currency}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        order: c.order,
        items: c.items.map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          price: i.price,
          imageUrl: i.imageUrl,
          isAvailable: i.isAvailable,
          categoryId: i.categoryId,
          tags: (i.tags ?? []).filter(
            (t): t is "favorite" | "spicy" | "vegan" =>
              t === "favorite" || t === "spicy" || t === "vegan",
          ),
        })),
      }))}
    />
  );
}
