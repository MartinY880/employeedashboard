// ProConnect — Training Video Thumbnail Upload
// POST: Upload a thumbnail image, returns { url }

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join, extname } from "path";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { UPLOADS_BASE } from "@/lib/uploads-dir";

const THUMBS_DIR = join(UPLOADS_BASE, "training");
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_TRAINING_VIDEOS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only PNG, JPG, and WebP images are allowed" }, { status: 400 });
    }

    await mkdir(THUMBS_DIR, { recursive: true });

    const ext = extname(file.name) || ".jpg";
    const storageName = `${randomUUID()}${ext}`;
    await writeFile(join(THUMBS_DIR, storageName), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ url: `/api/training-videos/upload-thumbnail/${storageName}` }, { status: 201 });
  } catch (err) {
    console.error("[Training Thumbnail Upload] error:", err);
    return NextResponse.json({ error: "Failed to upload thumbnail" }, { status: 500 });
  }
}
