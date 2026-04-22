import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { requireTenantAdmin } from "@/lib/auth/require";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  move: z.enum(["up", "down"]).optional(),
});

async function loadOwned(tenantId: string, categoryId: string) {
  const category = await prisma.menuCategory.findUnique({
    where: { id: categoryId },
    include: { menu: true },
  });
  if (!category || category.menu.restaurantId !== tenantId) return null;
  return category;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const gate = await requireTenantAdmin(tenant.id);
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const category = await loadOwned(tenant.id, id);
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { name, move } = parsed.data;

  if (name) {
    await prisma.menuCategory.update({ where: { id }, data: { name } });
  }

  if (move) {
    const siblings = await prisma.menuCategory.findMany({
      where: { menuId: category.menuId },
      orderBy: { order: "asc" },
    });
    const idx = siblings.findIndex((s) => s.id === id);
    const swapWith = move === "up" ? siblings[idx - 1] : siblings[idx + 1];
    if (swapWith) {
      await prisma.$transaction([
        prisma.menuCategory.update({
          where: { id: category.id },
          data: { order: swapWith.order },
        }),
        prisma.menuCategory.update({
          where: { id: swapWith.id },
          data: { order: category.order },
        }),
      ]);
    }
  }

  const updated = await prisma.menuCategory.findUnique({ where: { id } });
  return NextResponse.json({ category: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const gate = await requireTenantAdmin(tenant.id);
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const category = await loadOwned(tenant.id, id);
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.menuCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
