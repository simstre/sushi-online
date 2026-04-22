export type MenuItemTag = "favorite" | "spicy" | "vegan";

export const ALL_MENU_TAGS: MenuItemTag[] = ["favorite", "spicy", "vegan"];

/**
 * Display metadata for each known tag. `sortBoost` controls how a tag affects
 * item ordering within a category — lower sorts first. Favorites float above
 * everything (including most-liked); spicy/vegan are informational only.
 */
export const TAG_INFO: Record<
  MenuItemTag,
  {
    label: string;
    icon: "star" | "flame" | "leaf";
    badge: string;
    sortBoost: number | null;
  }
> = {
  favorite: {
    label: "Favorite",
    icon: "star",
    badge: "bg-green-50 text-green-700 border-green-200",
    sortBoost: 0,
  },
  spicy: {
    label: "Spicy",
    icon: "flame",
    badge: "bg-red-50 text-red-700 border-red-200",
    sortBoost: null,
  },
  vegan: {
    label: "Vegan",
    icon: "leaf",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    sortBoost: null,
  },
};

export function isKnownTag(x: string): x is MenuItemTag {
  return ALL_MENU_TAGS.includes(x as MenuItemTag);
}
