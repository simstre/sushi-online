import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(8).max(200),
});

/**
 * Owner/staff signup. Creates a new User and a pending RestaurantMember row
 * for the current tenant. The user must then be approved by an existing
 * tenant admin or a superadmin before they can access /admin.
 */
export async function POST(req: Request) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) {
    return NextResponse.json({ error: "Staff signup requires a tenant host" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid signup request" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      {
        error:
          "An account with that email already exists. Sign in instead, or contact the restaurant admin.",
      },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name ?? null,
      passwordHash,
      isSuperAdmin: false,
      memberships: {
        create: {
          restaurantId: tenant.id,
          role: "admin",
          status: "pending",
        },
      },
    },
  });

  return NextResponse.json({ user: { id: user.id, email: user.email } });
}
