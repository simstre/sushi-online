import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getTenantFromHeaders } from "@/lib/tenant/resolve";
import { requireTenantAdmin } from "@/lib/auth/require";

export const dynamic = "force-dynamic";

function csvEscape(value: string | number) {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const gate = await requireTenantAdmin(tenant.id);
  if (gate instanceof NextResponse) return gate;

  const orders = await prisma.order.findMany({
    where: { restaurantId: tenant.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  const header = ["id", "createdAt", "status", "customerName", "customerPhone", "total", "itemCount"];
  const rows = orders.map((o) =>
    [
      o.id,
      o.createdAt.toISOString(),
      o.status,
      o.customerName,
      o.customerPhone,
      o.totalAmount,
      o.items.reduce((sum, it) => sum + it.quantity, 0),
    ]
      .map(csvEscape)
      .join(","),
  );

  const csv = [header.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tenant.slug}-orders.csv"`,
    },
  });
}
