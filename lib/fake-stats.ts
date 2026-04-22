/**
 * Placeholder popularity score derived from the item's id. Drives the "Most Liked"
 * category and the #N badges. Replace with real aggregates from order tables when ready.
 */

export const MOST_LIKED_SLUG = "most-liked";
export const MOST_LIKED_NAME = "Most Liked";
export const MOST_LIKED_LIMIT = 8;

function score(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Top-N ranks keyed by item id, ordered by fake popularity score. */
export function rankByScore<T extends { id: string }>(items: T[], topN: number): Map<string, number> {
  const ranks = new Map<string, number>();
  [...items]
    .sort((a, b) => score(b.id) - score(a.id))
    .slice(0, topN)
    .forEach((item, i) => ranks.set(item.id, i + 1));
  return ranks;
}

export function pickMostLiked<T extends { id: string }>(items: T[], limit = MOST_LIKED_LIMIT): T[] {
  return [...items].sort((a, b) => score(b.id) - score(a.id)).slice(0, limit);
}
