import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireSuperAdmin, requireTenantAdmin } from "@/lib/auth/require";
import { storefrontUrl } from "@/lib/tenant/url";

const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().nonnegative(),
  imageUrl: z.string().url().optional(),
  isAvailable: z.boolean().optional(),
});

const menuSchema = z.object({
  name: z.string().optional().default("Main"),
  categories: z
    .array(
      z.object({
        name: z.string().min(1),
        items: z.array(itemSchema).default([]),
      }),
    )
    .default([]),
});

const hoursEntrySchema = z.object({
  day: z.number().int().min(0).max(6),
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
});

const createSchema = z.object({
  name: z.string().min(1),
  locationName: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  businessHours: z.array(hoursEntrySchema).optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumerics and dashes"),
  logoUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  currency: z.string().optional().default("CAD"),
  stripeAccountId: z.string().optional(),
  menu: menuSchema.optional(),
  ownerEmail: z.string().email().optional(),
});

export async function POST(req: Request) {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await prisma.restaurant.findUnique({ where: { slug: data.slug } });
  if (existing) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      name: data.name,
      locationName: data.locationName,
      slug: data.slug,
      logoUrl: data.logoUrl,
      bannerUrl: data.bannerUrl,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      currency: data.currency ?? "CAD",
      stripeAccountId: data.stripeAccountId,
      address: data.address,
      phone: data.phone,
      businessHours: data.businessHours,
      menus: data.menu
        ? {
            create: {
              name: data.menu.name ?? "Main",
              categories: {
                create: data.menu.categories.map((c, idx) => ({
                  name: c.name,
                  order: idx + 1,
                  items: {
                    create: c.items.map((i, itemIdx) => ({
                      name: i.name,
                      description: i.description ?? null,
                      price: i.price,
                      imageUrl: i.imageUrl ?? null,
                      isAvailable: i.isAvailable ?? true,
                      sortOrder: itemIdx + 1,
                    })),
                  },
                })),
              },
            },
          }
        : { create: { name: "Main" } },
    },
  });

  // Auto-provision membership if the caller supplied an owner email that matches a user.
  if (data.ownerEmail) {
    const owner = await prisma.user.findUnique({
      where: { email: data.ownerEmail.toLowerCase() },
    });
    if (owner) {
      await prisma.restaurantMember.create({
        data: { userId: owner.id, restaurantId: restaurant.id, role: "admin" },
      });
    }
  }

  return NextResponse.json({
    restaurant,
    url: storefrontUrl(restaurant.slug, "/menu"),
  });
}

const patchSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).optional(),
  locationName: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  businessHours: z.array(hoursEntrySchema).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  secondaryColor: z.string().nullable().optional(),
  currency: z.string().optional(),
  stripeAccountId: z.string().nullable().optional(),
});

export async function PATCH(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param required" }, { status: 400 });

  // Tenant admins can update their own restaurant; superadmins can update any.
  const gate = await requireTenantAdmin(id);
  if (gate instanceof NextResponse) return gate;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { id: _ignore, businessHours, ...rest } = parsed.data;
  const updated = await prisma.restaurant.update({
    where: { id },
    data: {
      ...rest,
      ...(businessHours !== undefined
        ? { businessHours: businessHours === null ? Prisma.JsonNull : businessHours }
        : {}),
    },
  });
  return NextResponse.json({ restaurant: updated });
}
