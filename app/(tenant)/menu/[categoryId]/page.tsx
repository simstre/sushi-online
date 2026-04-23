import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { ItemCard } from "../item-card";
import { ScrollToSection } from "../scroll-to-section";
import {
  MOST_LIKED_LIMIT,
  MOST_LIKED_NAME,
  MOST_LIKED_SLUG,
  pickMostLiked,
  rankByScore,
} from "@/lib/fake-stats";
import { type MenuItemTag, isKnownTag } from "@/lib/menu/tags";
import type { DialogModifierGroup } from "../item-dialog";

export const revalidate = 60;

type DisplayItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  tags: MenuItemTag[];
  modifiers: DialogModifierGroup[];
};

function parseModifiers(raw: unknown): DialogModifierGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: DialogModifierGroup[] = [];
  for (const g of raw) {
    if (!g || typeof g !== "object") continue;
    const group = g as Record<string, unknown>;
    const choicesRaw = Array.isArray(group.choices) ? group.choices : [];
    const choices = choicesRaw
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((c) => ({
        id: String(c.id ?? ""),
        name: String(c.name ?? ""),
        price: typeof c.price === "number" ? c.price : 0,
      }))
      .filter((c) => c.id && c.name);
    if (choices.length === 0) continue;
    out.push({
      id: String(group.id ?? ""),
      name: String(group.name ?? ""),
      required: group.required === true,
      maxSelect: typeof group.maxSelect === "number" ? group.maxSelect : 0,
      choices,
    });
  }
  return out;
}

type Section = {
  id: string;
  title: string;
  subtitle?: string | null;
  items: DisplayItem[];
};

export default async function MenuPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  const { categoryId } = await params;

  const menu = await prisma.menu.findFirst({
    where: { restaurantId: tenant.id },
    include: {
      categories: {
        orderBy: { order: "asc" },
        include: {
          items: {
            where: { isAvailable: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          },
        },
      },
    },
  });

  const withTags = (
    items: {
      id: string;
      name: string;
      description: string | null;
      price: number;
      imageUrl: string | null;
      isAvailable: boolean;
      tags: string[];
      modifiers: unknown;
    }[],
  ): DisplayItem[] =>
    items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      price: i.price,
      imageUrl: i.imageUrl,
      isAvailable: i.isAvailable,
      tags: (i.tags ?? []).filter(isKnownTag),
      modifiers: parseModifiers(i.modifiers),
    }));

  const categoriesWithItems = (menu?.categories ?? [])
    .filter((c) => c.items.length > 0)
    .map((c) => ({ ...c, items: withTags(c.items) }));

  if (categoriesWithItems.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">No menu yet.</p>;
  }

  const allItems = categoriesWithItems.flatMap((c) => c.items);
  const mostLiked = pickMostLiked(allItems, MOST_LIKED_LIMIT);

  const sections: Section[] = [];
  if (mostLiked.length > 0) {
    sections.push({
      id: MOST_LIKED_SLUG,
      title: MOST_LIKED_NAME,
      subtitle: "The most commonly ordered items and dishes from this store",
      items: mostLiked,
    });
  }
  for (const c of categoriesWithItems) {
    sections.push({ id: c.id, title: c.name, items: c.items });
  }

  // Initial deep-link target — falls back to Most Liked if the URL id doesn't match.
  const validIds = new Set(sections.map((s) => s.id));
  const initialId = validIds.has(categoryId) ? categoryId : MOST_LIKED_SLUG;

  return (
    <>
      <ScrollToSection id={initialId} />
      <div className="space-y-12 md:space-y-16">
        {sections.map((section) => {
          const ranks = rankByScore(section.items, 3);
          // Sort order: favorites first, then #1/#2/#3 most-liked, then the rest
          // in the original sortOrder/name order (Array.sort is stable).
          const sortedItems = [...section.items].sort((a, b) => {
            const af = a.tags.includes("favorite") ? 0 : 1;
            const bf = b.tags.includes("favorite") ? 0 : 1;
            if (af !== bf) return af - bf;
            const ra = ranks.get(a.id);
            const rb = ranks.get(b.id);
            if (ra && rb) return ra - rb;
            if (ra) return -1;
            if (rb) return 1;
            return 0;
          });
          return (
            <section
              key={section.id}
              id={`cat-${section.id}`}
              className="scroll-mt-28 md:scroll-mt-24"
            >
              <h2 className="text-2xl font-bold tracking-tight">{section.title}</h2>
              {section.subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{section.subtitle}</p>
              )}
              <ul className="mt-4 grid grid-cols-1 gap-3 md:mt-6 md:grid-cols-2 md:gap-4">
                {sortedItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    rank={ranks.get(item.id)}
                    currency={tenant.currency}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
