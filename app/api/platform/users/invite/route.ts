import { NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/require";
import { sendInviteEmail } from "@/lib/email";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
  isSuperAdmin: z.boolean().optional(),
  restaurantId: z.string().optional(),
  role: z.enum(["admin", "staff"]).optional(),
});

const INVITE_TTL_DAYS = 7;

function newToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export async function POST(req: Request) {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { email: rawEmail, name, isSuperAdmin, restaurantId, role } = parsed.data;
  const email = rawEmail.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A user with that email already exists" },
      { status: 409 },
    );
  }

  let restaurantName: string | undefined;
  if (restaurantId) {
    const r = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, locationName: true },
    });
    if (!r) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    restaurantName = r.locationName ? `${r.name} — ${r.locationName}` : r.name;
  }

  // Random unusable password until they set their own via the invite link.
  const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
  const { token, tokenHash } = newToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email,
      name: name ?? null,
      passwordHash: placeholderHash,
      isSuperAdmin: Boolean(isSuperAdmin),
      ...(restaurantId
        ? {
            memberships: {
              create: { restaurantId, role: role ?? "admin", status: "active" },
            },
          }
        : {}),
      resetTokens: {
        create: { tokenHash, expiresAt },
      },
    },
  });

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const proto = rootDomain.startsWith("localhost") ? "http" : "https";
  const inviteUrl = `${proto}://${rootDomain}/reset-password/${token}`;

  const invitedAs: "platform admin" | "restaurant admin" | "restaurant staff" = isSuperAdmin
    ? "platform admin"
    : role === "staff"
      ? "restaurant staff"
      : "restaurant admin";

  const emailResult = await sendInviteEmail({
    to: email,
    inviteUrl,
    invitedAs,
    tenantName: restaurantName,
  });

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    emailSent: emailResult.ok,
    emailError: emailResult.ok ? null : emailResult.error,
    inviteUrl,
  });
}
