import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { requireTenantAdmin } from "@/lib/auth/require";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().int().nonnegative().optional(),
  imageUrl: z.string().url().nullable().optional(),
  isAvailable: z.boolean().optional(),
  tags: z.array(z.enum(["favorite", "spicy", "vegan"])).optional(),
  categoryId: z.string().min(1).optional(),
  move: z.enum(["up", "down"]).optional(),
});

async function loadOwned(tenantId: string, itemId: string) {
  const item = await prisma.menuItem.findUnique({
    where: { id: itemId },
    include: { category: { include: { menu: true } } },
  });
  if (!item || item.category.menu.restaurantId !== tenantId) return null;
  return item;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const gate = await requireTenantAdmin(tenant.id);
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const item = await loadOwned(tenant.id, id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { move, categoryId, ...data } = parsed.data;

  // Moving to another category requires tenant ownership of the new category too.
  if (categoryId && categoryId !== item.categoryId) {
    const next = await prisma.menuCategory.findUnique({
      where: { id: categoryId },
      include: { menu: true },
    });
    if (!next || next.menu.restaurantId !== tenant.id) {
      return NextResponse.json({ error: "Target category not found" }, { status: 404 });
    }
    const count = await prisma.menuItem.count({ where: { categoryId } });
    await prisma.menuItem.update({
      where: { id },
      data: { categoryId, sortOrder: count + 1 },
    });
  }

  if (Object.keys(data).length > 0) {
    await prisma.menuItem.update({ where: { id }, data });
  }

  if (move) {
    const siblings = await prisma.menuItem.findMany({
      where: { categoryId: item.categoryId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    const idx = siblings.findIndex((s) => s.id === id);
    const swapWith = move === "up" ? siblings[idx - 1] : siblings[idx + 1];
    if (swapWith) {
      await prisma.$transaction([
        prisma.menuItem.update({
          where: { id: item.id },
          data: { sortOrder: swapWith.sortOrder },
        }),
        prisma.menuItem.update({
          where: { id: swapWith.id },
          data: { sortOrder: item.sortOrder },
        }),
      ]);
    }
  }

  const updated = await prisma.menuItem.findUnique({ where: { id } });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const gate = await requireTenantAdmin(tenant.id);
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const item = await loadOwned(tenant.id, id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.menuItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
