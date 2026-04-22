import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require";
import { sendEmail } from "@/lib/email/send";

export const runtime = "nodejs";

const TOKEN_BYTES = 32;
const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const user = await prisma.user.findUnique({ where: { id: gate.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Invalidate any prior unused tokens for this user.
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

  await sendEmail({
    to: user.email,
    subject: "Reset your sushi-online password",
    text:
      `Hi${user.name ? ` ${user.name}` : ""},\n\n` +
      `Click the link below within the next hour to set a new password:\n\n` +
      `${resetUrl}\n\n` +
      `If you didn't request this, you can ignore this email.\n`,
  });

  return NextResponse.json({ ok: true });
}
