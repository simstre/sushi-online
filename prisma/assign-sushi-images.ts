import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Assign a loremflickr "sushi"-tagged image to every menu item that doesn't
 * already have one. The lock param is derived from the item's id, so the same
 * item always gets the same picture (idempotent across runs).
 */
async function main() {
  const items = await prisma.menuItem.findMany({
    where: { OR: [{ imageUrl: null }, { imageUrl: "" }] },
  });

  if (items.length === 0) {
    console.log("No items need images.");
    return;
  }

  for (const item of items) {
    // Convert cuid to a stable positive integer seed.
    const lock = Math.abs(hashString(item.id)) % 10_000;
    const url = `https://loremflickr.com/600/600/sushi?lock=${lock}`;
    await prisma.menuItem.update({ where: { id: item.id }, data: { imageUrl: url } });
    console.log(`  ${item.name.padEnd(24)} → ${url}`);
  }
  console.log(`Updated ${items.length} items.`);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
