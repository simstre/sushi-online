import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/require";

const patchSchema = z.object({
  name: z.string().min(1).max(120).nullable().optional(),
  isSuperAdmin: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Guard against the last superadmin demoting themselves.
  if (parsed.data.isSuperAdmin === false) {
    const remaining = await prisma.user.count({
      where: { isSuperAdmin: true, NOT: { id } },
    });
    if (remaining === 0) {
      return NextResponse.json(
        { error: "Cannot revoke the last superadmin." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, email: true, name: true, isSuperAdmin: true },
  });
  return NextResponse.json({ user: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, isSuperAdmin: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (target.id === gate.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }
  if (target.isSuperAdmin) {
    const remaining = await prisma.user.count({
      where: { isSuperAdmin: true, NOT: { id } },
    });
    if (remaining === 0) {
      return NextResponse.json({ error: "Cannot delete the last superadmin." }, { status: 400 });
    }
  }

  // Preserve order history by detaching the user; cascade deletes memberships + reset tokens.
  await prisma.$transaction([
    prisma.order.updateMany({ where: { userId: id }, data: { userId: null } }),
    prisma.user.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
