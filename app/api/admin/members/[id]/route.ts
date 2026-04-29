import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenantAdmin } from "@/lib/auth/require";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";

const patchSchema = z.object({
  status: z.enum(["pending", "active"]).optional(),
  role: z.enum(["admin", "staff"]).optional(),
});

async function loadMember(id: string) {
  return prisma.restaurantMember.findUnique({ where: { id } });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 404 });

  const gate = await requireTenantAdmin(tenant.id);
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const member = await loadMember(id);
  if (!member || member.restaurantId !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const updated = await prisma.restaurantMember.update({
    where: { id },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
    },
  });
  return NextResponse.json({ member: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 404 });

  const gate = await requireTenantAdmin(tenant.id);
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const member = await loadMember(id);
  if (!member || member.restaurantId !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.restaurantMember.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
