// ProConnect — Training Videos [id] API
// GET: fetch single video (public)  PUT: update  DELETE: delete + thumbnail file

import { unlink } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { UPLOADS_BASE } from "@/lib/uploads-dir";

const THUMBS_DIR = join(UPLOADS_BASE, "training");

type Params = { params: Promise<{ id: string }> };

// ─── GET (public) ─────────────────────────────────────────

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const video = await prisma.trainingVideo.findUnique({ where: { id } });
    if (!video || !video.active) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ video });
  } catch (err) {
    console.error("[Training Videos] GET [id] error:", err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

// ─── PUT (update) ─────────────────────────────────────────

export async function PUT(request: Request, { params }: Params) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_TRAINING_VIDEOS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.trainingVideo.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.zoomUrl !== undefined) data.zoomUrl = String(body.zoomUrl).trim();
    if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
    if (body.presenter !== undefined) data.presenter = body.presenter ? String(body.presenter).trim() : null;
    if (body.category !== undefined) data.category = String(body.category).trim();
    if (body.recordedAt !== undefined) data.recordedAt = body.recordedAt ? new Date(body.recordedAt) : null;
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);
    if (body.featured !== undefined) data.featured = Boolean(body.featured);
    if (body.active !== undefined) data.active = Boolean(body.active);

    // If a new thumbnail URL is provided and the old one was a local upload, delete the old file
    if (body.thumbnailUrl !== undefined) {
      const newUrl = body.thumbnailUrl ? String(body.thumbnailUrl).trim() : null;
      if (
        existing.thumbnailUrl &&
        existing.thumbnailUrl !== newUrl &&
        existing.thumbnailUrl.startsWith("/api/training-videos/upload-thumbnail/")
      ) {
        const oldFilename = existing.thumbnailUrl.split("/").pop() ?? "";
        const safe = oldFilename.replace(/[^a-zA-Z0-9._-]/g, "");
        if (safe) {
          await unlink(join(THUMBS_DIR, safe)).catch(() => {});
        }
      }
      data.thumbnailUrl = newUrl;
    }

    const video = await prisma.trainingVideo.update({ where: { id }, data });
    return NextResponse.json({ video });
  } catch (err) {
    console.error("[Training Videos] PUT error:", err);
    return NextResponse.json({ error: "Failed to update training video" }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_TRAINING_VIDEOS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.trainingVideo.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Delete thumbnail file if it's a local upload
    if (existing.thumbnailUrl?.startsWith("/api/training-videos/upload-thumbnail/")) {
      const filename = existing.thumbnailUrl.split("/").pop() ?? "";
      const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "");
      if (safe) await unlink(join(THUMBS_DIR, safe)).catch(() => {});
    }

    await prisma.trainingVideo.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Training Videos] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete training video" }, { status: 500 });
  }
}
