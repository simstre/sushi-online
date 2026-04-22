import { notFound } from "next/navigation";
import { Flame, Leaf, Star } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { AddToCartButton } from "../add-to-cart";
import { ScrollToSection } from "../scroll-to-section";
import { cn, formatMoney } from "@/lib/utils";
import {
  MOST_LIKED_LIMIT,
  MOST_LIKED_NAME,
  MOST_LIKED_SLUG,
  pickMostLiked,
  rankByScore,
} from "@/lib/fake-stats";
import { ALL_MENU_TAGS, TAG_INFO, type MenuItemTag, isKnownTag } from "@/lib/menu/tags";

export const revalidate = 60;

type DisplayItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  tags: MenuItemTag[];
};

function ItemTagBadges({ tags }: { tags: MenuItemTag[] }) {
  if (tags.length === 0) return null;
  // Favorite uses a richer "#N" style badge already rendered via the favorite+rank path;
  // we still show the icon here if favorite is present alongside spicy/vegan.
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.map((tag) => {
        const info = TAG_INFO[tag];
        const Icon = info.icon === "flame" ? Flame : info.icon === "leaf" ? Leaf : Star;
        return (
          <span
            key={tag}
            className={cn(
              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium",
              info.badge,
            )}
          >
            <Icon className="h-3 w-3" />
            {info.label}
          </span>
        );
      })}
    </div>
  );
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

  const withTags = (items: { id: string; name: string; description: string | null; price: number; imageUrl: string | null; isAvailable: boolean; tags: string[] }[]): DisplayItem[] =>
    items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      price: i.price,
      imageUrl: i.imageUrl,
      isAvailable: i.isAvailable,
      tags: (i.tags ?? []).filter(isKnownTag),
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
                {sortedItems.map((item) => {
                  const rank = ranks.get(item.id);
                  return (
                    <li
                      key={item.id}
                      className="flex items-stretch overflow-hidden rounded-lg border border-border bg-background transition-colors hover:border-primary/40"
                    >
                      <div className="flex min-w-0 flex-1 flex-col p-4">
                        <h3 className="text-sm font-bold uppercase tracking-wide">
                          {item.name}
                        </h3>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.tags.includes("favorite") && (
                            <span className="inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">
                              <Star className="h-3 w-3" />
                              Favorite
                            </span>
                          )}
                          {rank && !item.tags.includes("favorite") && (
                            <span className="inline-flex items-center rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">
                              #{rank} Most liked
                            </span>
                          )}
                          {item.tags
                            .filter((t) => t !== "favorite")
                            .map((tag) => {
                              const info = TAG_INFO[tag];
                              const Icon = info.icon === "flame" ? Flame : Leaf;
                              return (
                                <span
                                  key={tag}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium",
                                    info.badge,
                                  )}
                                >
                                  <Icon className="h-3 w-3" />
                                  {info.label}
                                </span>
                              );
                            })}
                        </div>
                        {item.description && (
                          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between pt-3 text-sm">
                          <span>{formatMoney(item.price, tenant.currency)}</span>
                          {!item.imageUrl && (
                            <AddToCartButton
                              variant="icon"
                              item={{ id: item.id, name: item.name, price: item.price }}
                            />
                          )}
                        </div>
                      </div>
                      {item.imageUrl && (
                        <div className="relative flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-32 w-32 object-cover md:h-40 md:w-40"
                            loading="lazy"
                          />
                          <AddToCartButton
                            variant="icon"
                            item={{ id: item.id, name: item.name, price: item.price }}
                            className="absolute bottom-2 right-2"
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
