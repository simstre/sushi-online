import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(200).optional(),
});

export async function PATCH(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { name, currentPassword, newPassword } = parsed.data;

  if (newPassword && !currentPassword) {
    return NextResponse.json(
      { error: "Current password is required to change password" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: gate.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const data: { name?: string | null; passwordHash?: string } = {};

  if (typeof name === "string") data.name = name;

  if (newPassword) {
    const ok = await bcrypt.compare(currentPassword!, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { id: true, email: true, name: true },
  });
  return NextResponse.json({ user: updated });
}
