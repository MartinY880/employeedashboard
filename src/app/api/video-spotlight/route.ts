// ProConnect — Video Spotlight API Route
// GET: List videos | PATCH: Toggle visibility

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  listVideoSpotlights,
  getVideoSpotlightVisibility,
  setVideoSpotlightVisibility,
} from "@/lib/video-spotlight-store";

export async function GET(request: Request) {
  try {
    const { isAuthenticated } = await getAuthUser();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const featured = searchParams.get("featured");
    const status = searchParams.get("status");

    const filters: { featured?: boolean; status?: string } = {};
    if (featured === "true") filters.featured = true;
    if (featured === "false") filters.featured = false;
    if (status) filters.status = status;

    const [videos, visibility] = await Promise.all([
      listVideoSpotlights(filters),
      getVideoSpotlightVisibility(),
    ]);

    // Enrich with comment counts
    const videoIds = videos.map((v) => v.id);
    const commentCounts = videoIds.length > 0
      ? await prisma.videoSpotlightComment.groupBy({
          by: ["videoId"],
          where: { videoId: { in: videoIds }, deletedAt: null },
          _count: { id: true },
        })
      : [];
    const countMap = new Map(commentCounts.map((c) => [c.videoId, c._count.id]));
    const enrichedVideos = videos.map((v) => ({ ...v, commentCount: countMap.get(v.id) ?? 0 }));

    return NextResponse.json({ videos: enrichedVideos, visibility });
  } catch (error) {
    console.error("[Video Spotlight API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}

/** PATCH — toggle feature visibility (admin only) */
export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_VIDEO_SPOTLIGHT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const enabled = body.enabled === true;
    const visibility = await setVideoSpotlightVisibility(enabled);

    return NextResponse.json({ visibility });
  } catch (error) {
    console.error("[Video Spotlight API] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update visibility" }, { status: 500 });
  }
}

/** PUT — bulk reorder (admin only). Body: { order: [{ id, sortOrder }] } */
export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_VIDEO_SPOTLIGHT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const order = body.order;
    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: "order array is required" }, { status: 400 });
    }

    // Validate entries
    const updates = order
      .filter((item: unknown) => {
        if (!item || typeof item !== "object") return false;
        const obj = item as Record<string, unknown>;
        return typeof obj.id === "string" && typeof obj.sortOrder === "number";
      })
      .map((item: { id: string; sortOrder: number }) => ({
        id: item.id,
        sortOrder: item.sortOrder,
      }));

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid entries in order array" }, { status: 400 });
    }

    // Batch update all sort orders in a transaction
    await prisma.$transaction(
      updates.map((u) =>
        prisma.videoSpotlight.update({
          where: { id: u.id },
          data: { sortOrder: u.sortOrder },
        })
      )
    );

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (error) {
    console.error("[Video Spotlight API] PUT error:", error);
    return NextResponse.json({ error: "Failed to reorder videos" }, { status: 500 });
  }
}
