import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

type AuthedUser = {
  id: string;
  email: string;
  name: string | null;
  isSuperAdmin: boolean;
};

export async function getCurrentUser(): Promise<AuthedUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    isSuperAdmin: session.user.isSuperAdmin,
  };
}

/**
 * Returns the current user or a 401 NextResponse. Usage:
 *   const res = await requireUser(); if (res instanceof NextResponse) return res;
 */
export async function requireUser(): Promise<AuthedUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return user;
}

export async function requireSuperAdmin(): Promise<AuthedUser | NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (!user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

/**
 * Require the caller to be a member of the given tenant (or a superadmin).
 */
export async function requireTenantAdmin(
  restaurantId: string,
): Promise<AuthedUser | NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.isSuperAdmin) return user;

  const membership = await prisma.restaurantMember.findUnique({
    where: { userId_restaurantId: { userId: user.id, restaurantId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

/**
 * For use in server components / layouts (throws rather than returning a response).
 */
export async function canAdminTenant(restaurantId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  const m = await prisma.restaurantMember.findUnique({
    where: { userId_restaurantId: { userId: user.id, restaurantId } },
  });
  return Boolean(m);
}
