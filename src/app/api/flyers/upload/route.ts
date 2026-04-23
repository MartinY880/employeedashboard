// ProConnect — Flyer Upload API
// POST: Upload a flyer image

import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS, toDbRole } from "@/lib/rbac";
import { ensureDbUser } from "@/lib/prisma";
import { createFlyer } from "@/lib/flyer-store";
import { UPLOADS_BASE } from "@/lib/uploads-dir";

const FLYERS_DIR = join(UPLOADS_BASE, "flyers");
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

async function ensureFlyersDir() {
  await mkdir(FLYERS_DIR, { recursive: true });
}

function getExtension(filename: string, mimeType: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return ext;
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("svg")) return "svg";
  return "jpg";
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_FLYERS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const file = formData.get("image");
    const startDate = formData.get("startDate") ? String(formData.get("startDate")) : null;
    const endDate = formData.get("endDate") ? String(formData.get("endDate")) : null;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "An image file is required" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    const mimeType = file.type || "image/jpeg";
    if (!ACCEPTED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported image format. Accepted: JPEG, PNG, GIF, WebP, SVG" },
        { status: 400 }
      );
    }

    const dbUser = await ensureDbUser(
      user.sub,
      user.email ?? "",
      user.name ?? user.email ?? "Unknown",
      toDbRole(user.role)
    );

    const ext = getExtension(file.name, mimeType);
    const storageName = `${randomUUID()}.${ext}`;
    await ensureFlyersDir();
    const bytes = await file.arrayBuffer();
    await writeFile(join(FLYERS_DIR, storageName), Buffer.from(bytes));

    const flyer = await createFlyer({
      title,
      filename: storageName,
      mimeType,
      fileSize: file.size,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      authorId: dbUser.id,
    });

    return NextResponse.json({ flyer }, { status: 201 });
  } catch (error) {
    console.error("[Flyer Upload] POST error:", error);
    return NextResponse.json({ error: "Failed to upload flyer" }, { status: 500 });
  }
}
