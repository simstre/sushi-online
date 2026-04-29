import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/require";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  locationName: z.string().max(200).nullable().optional(),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, digits, and hyphens")
    .optional(),
  inactive: z.boolean().optional(),
  orderOpen: z.boolean().optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(80).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.slug) {
    const conflict = await prisma.restaurant.findFirst({
      where: { slug: parsed.data.slug, NOT: { id } },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }
  }

  const updated = await prisma.restaurant.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      locationName: true,
      slug: true,
      inactive: true,
      orderOpen: true,
    },
  });
  return NextResponse.json({ restaurant: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: { id: true, _count: { select: { orders: true } } },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Refuse to hard-delete tenants with order history; suspend instead.
  if (restaurant._count.orders > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete a restaurant with order history. Suspend it instead (set inactive).",
      },
      { status: 400 },
    );
  }

  await prisma.restaurant.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
