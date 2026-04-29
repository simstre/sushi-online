import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/require";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";

const TOKEN_BYTES = 32;
const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + EXPIRY_MS);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const origin = new URL(req.url).origin;
  const resetUrl = `${origin}/reset-password/${token}`;

  const result = await sendPasswordResetEmail({
    to: user.email,
    resetUrl,
    name: user.name,
    expiresInMinutes: 60,
  });

  return NextResponse.json({
    emailSent: result.ok,
    emailError: result.ok ? null : result.error,
    resetUrl,
  });
}
