import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { requireTenantAdmin } from "@/lib/auth/require";

const createSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().int().nonnegative(),
  imageUrl: z.string().url().optional().nullable(),
  isAvailable: z.boolean().optional(),
  tags: z.array(z.enum(["favorite", "spicy", "vegan"])).optional(),
});

export async function POST(req: Request) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const gate = await requireTenantAdmin(tenant.id);
  if (gate instanceof NextResponse) return gate;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const category = await prisma.menuCategory.findUnique({
    where: { id: body.categoryId },
    include: { menu: true },
  });
  if (!category || category.menu.restaurantId !== tenant.id) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const count = await prisma.menuItem.count({ where: { categoryId: body.categoryId } });
  const item = await prisma.menuItem.create({
    data: {
      categoryId: body.categoryId,
      name: body.name,
      description: body.description || null,
      price: body.price,
      imageUrl: body.imageUrl || null,
      isAvailable: body.isAvailable ?? true,
      tags: body.tags ?? [],
      sortOrder: count + 1,
    },
  });
  return NextResponse.json({ item });
}
