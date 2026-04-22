import { prisma } from "@/lib/db/prisma";

/**
 * Every tenant has exactly one Menu in the current data model ("Main").
 * This returns the existing menu or creates it on first admin interaction.
 */
export async function ensureDefaultMenu(restaurantId: string) {
  const existing = await prisma.menu.findFirst({ where: { restaurantId } });
  if (existing) return existing;
  return prisma.menu.create({ data: { restaurantId, name: "Main" } });
}
