import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/require";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string().min(8),
  restaurantId: z.string().optional(),
  isSuperAdmin: z.boolean().optional(),
});

/**
 * Create a user and optionally attach them as admin to a restaurant.
 * Superadmin-only for now; the tenant admin UI can expose a subset later.
 */
export async function POST(req: Request) {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, name, password, restaurantId, isSuperAdmin } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "User exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      passwordHash,
      isSuperAdmin: Boolean(isSuperAdmin),
    },
  });

  if (restaurantId) {
    await prisma.restaurantMember.create({
      data: { userId: user.id, restaurantId, role: "admin" },
    });
  }

  return NextResponse.json({ user: { id: user.id, email: user.email } });
}
