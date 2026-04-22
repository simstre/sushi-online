import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { requireTenantAdmin } from "@/lib/auth/require";
import { ensureDefaultMenu } from "@/lib/tenant/ensure-menu";

const createSchema = z.object({ name: z.string().min(1).max(120) });

export async function POST(req: Request) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const gate = await requireTenantAdmin(tenant.id);
  if (gate instanceof NextResponse) return gate;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const menu = await ensureDefaultMenu(tenant.id);
  const count = await prisma.menuCategory.count({ where: { menuId: menu.id } });
  const category = await prisma.menuCategory.create({
    data: { menuId: menu.id, name: parsed.data.name, order: count + 1 },
  });
  return NextResponse.json({ category });
}
