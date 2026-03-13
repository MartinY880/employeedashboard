// ProConnect — Collage Background Images API
// POST: Upload images (auto-downscaled via sharp) | GET: List images | DELETE: Remove an image
// Storage: files in uploads/collage-bg/, manifest in calendar_settings table

import { randomUUID } from "crypto";
import { mkdir, writeFile, readdir, unlink, stat } from "fs/promises";
import { join, extname, basename } from "path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { UPLOADS_BASE } from "@/lib/uploads-dir";
import { prisma } from "@/lib/prisma";

const DB_KEY_COLLAGE = "collage_bg_settings";

async function loadCollageSettings(): Promise<{ opacity: number }> {
  try {
    const row = await prisma.calendarSetting.findUnique({ where: { id: DB_KEY_COLLAGE } });
    if (row?.data) return JSON.parse(row.data);
  } catch {}
  return { opacity: 80 };
}

const COLLAGE_DIR = join(UPLOADS_BASE, "collage-bg");
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB raw upload limit
const THUMB_WIDTH = 600; // downscale to max 600px wide
const THUMB_QUALITY = 70; // JPEG/WebP quality
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_PILLARS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files");

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    await mkdir(COLLAGE_DIR, { recursive: true });

    const uploaded: { url: string; filename: string }[] = [];

    for (const file of files) {
      if (!(file instanceof File) || file.size <= 0) continue;
      if (file.size > MAX_SIZE) continue;

      const mime = file.type || "";
      if (!ALLOWED_TYPES.includes(mime)) continue;

      const bytes = Buffer.from(await file.arrayBuffer());

      // Downscale with sharp — output as WebP for smallest size
      const processed = await sharp(bytes)
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toBuffer();

      const storageName = `${randomUUID()}.webp`;
      await writeFile(join(COLLAGE_DIR, storageName), processed);

      uploaded.push({
        url: `/api/collage-bg/${storageName}`,
        filename: storageName,
      });
    }

    return NextResponse.json({ images: uploaded }, { status: 201 });
  } catch (err) {
    console.error("[Collage BG Upload] error:", err);
    return NextResponse.json({ error: "Failed to upload images" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const [, settings] = await Promise.all([
      mkdir(COLLAGE_DIR, { recursive: true }),
      loadCollageSettings(),
    ]);
    const files = await readdir(COLLAGE_DIR);
    const images = files
      .filter((f) => /\.(webp|png|jpe?g|gif)$/i.test(f))
      .map((f) => ({ url: `/api/collage-bg/${f}`, filename: f }));
    return NextResponse.json({ images, opacity: settings.opacity });
  } catch {
    return NextResponse.json({ images: [], opacity: 80 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_PILLARS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json();
    const opacity = Math.max(0, Math.min(100, Number(body.opacity) || 80));
    const data = JSON.stringify({ opacity });
    await prisma.calendarSetting.upsert({
      where: { id: DB_KEY_COLLAGE },
      update: { data },
      create: { id: DB_KEY_COLLAGE, data },
    });
    return NextResponse.json({ opacity });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_PILLARS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { filename } = await request.json();
    if (!filename || typeof filename !== "string") {
      return NextResponse.json({ error: "filename required" }, { status: 400 });
    }

    const safe = basename(filename).replace(/[^a-zA-Z0-9._-]/g, "");
    const filePath = join(COLLAGE_DIR, safe);

    try {
      const info = await stat(filePath);
      if (info.isFile()) await unlink(filePath);
    } catch {
      // File doesn't exist — treat as success
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
