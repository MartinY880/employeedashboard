// ProConnect — Video Spotlight Item API
// GET: Get single video | PATCH: Update metadata | DELETE: Remove video

import { unlink } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import {
  getVideoSpotlightById,
  updateVideoSpotlight,
  deleteVideoSpotlight,
} from "@/lib/video-spotlight-store";

const VIDEOS_DIR = join(process.cwd(), "uploads", "videos");

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { isAuthenticated } = await getAuthUser();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const video = await getVideoSpotlightById(id);
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({ video });
  } catch (error) {
    console.error("[Video Spotlight API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch video" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_VIDEO_SPOTLIGHT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const allowed: Record<string, unknown> = {};
    if (typeof body.title === "string" && body.title.trim()) allowed.title = body.title.trim();
    if (body.description !== undefined) allowed.description = body.description ?? null;
    if (typeof body.featured === "boolean") allowed.featured = body.featured;
    if (typeof body.sortOrder === "number") allowed.sortOrder = body.sortOrder;
    if (body.status === "active" || body.status === "archived") allowed.status = body.status;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const video = await updateVideoSpotlight(id, allowed);
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({ video });
  } catch (error) {
    console.error("[Video Spotlight API] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update video" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_VIDEO_SPOTLIGHT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Fetch record first to get filename for file cleanup
    const video = await getVideoSpotlightById(id);
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Delete from DB
    const deleted = await deleteVideoSpotlight(id);
    if (!deleted) {
      return NextResponse.json({ error: "Failed to delete video" }, { status: 500 });
    }

    // Delete file (best-effort, don't fail if missing)
    try {
      await unlink(join(VIDEOS_DIR, video.filename));
    } catch {
      // file may already be gone
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Video Spotlight API] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete video" }, { status: 500 });
  }
}
