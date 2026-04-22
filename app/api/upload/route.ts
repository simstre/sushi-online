import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { requireUser } from "@/lib/auth/require";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

/**
 * Accepts multipart/form-data with a "file" field and an optional "prefix".
 * Returns { url } pointing to a public CDN URL.
 *
 * Auth: any signed-in user. Per-tenant mutations that persist the URL still
 * enforce their own tenant-admin check, so we don't over-restrict upload here.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const prefix = String(form?.get("prefix") ?? "uploads");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 415 });
  }

  const ext = extensionFor(file.type) ?? path.extname(file.name) ?? "";
  const safePrefix = prefix.replace(/[^a-zA-Z0-9/_-]/g, "-").replace(/^\/+|\/+$/g, "");
  const key = `${safePrefix}/${Date.now()}-${crypto.randomUUID()}${ext}`;

  // Production: Vercel Blob (requires BLOB_READ_WRITE_TOKEN).
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });
    return NextResponse.json({ url: blob.url });
  }

  // Dev fallback: write to /public/uploads. Does NOT work on Vercel prod.
  const destDir = path.join(process.cwd(), "public", "uploads", safePrefix);
  await fs.mkdir(destDir, { recursive: true });
  const destPath = path.join(destDir, path.basename(key));
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(destPath, buf);

  const publicUrl = `/uploads/${safePrefix}/${path.basename(key)}`;
  return NextResponse.json({ url: publicUrl });
}

function extensionFor(mime: string): string | null {
  switch (mime) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/svg+xml":
      return ".svg";
    default:
      return null;
  }
}
