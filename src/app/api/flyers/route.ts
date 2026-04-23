// ProConnect — Flyers API Route
// GET: List flyers | PATCH: Update flyer

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listFlyers, updateFlyer } from "@/lib/flyer-store";

export async function GET(request: Request) {
  try {
    const { isAuthenticated } = await getAuthUser();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const activeOnly = searchParams.get("active") === "true";

    const flyers = await listFlyers({ status: status || undefined, activeOnly });
    return NextResponse.json({ flyers });
  } catch (error) {
    console.error("[Flyers API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch flyers" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_FLYERS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, title, status, sortOrder, startDate, endDate } = body;

    if (!id) {
      return NextResponse.json({ error: "Flyer ID is required" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = String(title).trim();
    if (status !== undefined) data.status = status;
    if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;

    const flyer = await updateFlyer(id, data);
    return NextResponse.json({ flyer });
  } catch (error) {
    console.error("[Flyers API] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update flyer" }, { status: 500 });
  }
}
