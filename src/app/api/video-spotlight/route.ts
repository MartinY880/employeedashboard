// ProConnect — Video Spotlight API Route
// GET: List videos | PATCH: Toggle visibility

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
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

    return NextResponse.json({ videos, visibility });
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
