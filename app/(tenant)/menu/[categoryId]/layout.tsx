import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { CategoryChipsMobile, CategorySidebar } from "../category-nav";
import { MOST_LIKED_LIMIT, MOST_LIKED_NAME, MOST_LIKED_SLUG } from "@/lib/fake-stats";

export const dynamic = "force-dynamic";

export default async function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ categoryId: string }>;
}) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  const { categoryId } = await params;

  const [menu, availableItemCount] = await Promise.all([
    prisma.menu.findFirst({
      where: { restaurantId: tenant.id },
      include: {
        categories: {
          orderBy: { order: "asc" },
          include: {
            _count: { select: { items: { where: { isAvailable: true } } } },
          },
        },
      },
    }),
    prisma.menuItem.count({
      where: { isAvailable: true, category: { menu: { restaurantId: tenant.id } } },
    }),
  ]);

  const realCategories = (menu?.categories ?? [])
    .filter((c) => c._count.items > 0)
    .map((c) => ({ id: c.id, name: c.name, count: c._count.items }));

  const categories =
    availableItemCount > 0
      ? [
          {
            id: MOST_LIKED_SLUG,
            name: MOST_LIKED_NAME,
            count: Math.min(MOST_LIKED_LIMIT, availableItemCount),
          },
          ...realCategories,
        ]
      : realCategories;

  return (
    <div>
      <CategoryChipsMobile categories={categories} activeId={categoryId} />
      <div className="md:grid md:grid-cols-[220px_1fr] md:gap-8 md:pt-4">
        <CategorySidebar categories={categories} activeId={categoryId} />
        <div className="min-w-0 pt-4 md:pt-0">{children}</div>
      </div>
    </div>
  );
}
