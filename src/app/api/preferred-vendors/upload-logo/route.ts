// ProConnect — Vendor Logo Upload API
// POST: Upload a vendor logo image, returns { url }

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join, extname } from "path";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { UPLOADS_BASE } from "@/lib/uploads-dir";

const LOGOS_DIR = join(UPLOADS_BASE, "vendor-logos");
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml", "image/gif"];

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_VENDORS)) {
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

    const mime = file.type || "";
    if (!ALLOWED_TYPES.includes(mime)) {
      return NextResponse.json({ error: "Only PNG, JPG, WebP, SVG, and GIF images are allowed" }, { status: 400 });
    }

    // Ensure dir exists
    await mkdir(LOGOS_DIR, { recursive: true });

    const ext = extname(file.name) || ".png";
    const storageName = `${randomUUID()}${ext}`;
    const bytes = await file.arrayBuffer();
    await writeFile(join(LOGOS_DIR, storageName), Buffer.from(bytes));

    const url = `/api/preferred-vendors/upload-logo/${storageName}`;

    return NextResponse.json({ url }, { status: 201 });
  } catch (err) {
    console.error("[Vendor Logo Upload] error:", err);
    return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 });
  }
}
