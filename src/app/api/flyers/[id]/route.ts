// ProConnect — Single Flyer API
// GET: Fetch one | PATCH: Update | DELETE: Remove

import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { join } from "path";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { getFlyerById, updateFlyer, deleteFlyer } from "@/lib/flyer-store";
import { UPLOADS_BASE } from "@/lib/uploads-dir";

const FLYERS_DIR = join(UPLOADS_BASE, "flyers");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAuthenticated } = await getAuthUser();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const flyer = await getFlyerById(id);
    if (!flyer) {
      return NextResponse.json({ error: "Flyer not found" }, { status: 404 });
    }

    return NextResponse.json({ flyer });
  } catch (error) {
    console.error("[Flyer API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch flyer" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_FLYERS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.status !== undefined) data.status = body.status;
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;

    const flyer = await updateFlyer(id, data);
    return NextResponse.json({ flyer });
  } catch (error) {
    console.error("[Flyer API] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update flyer" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_FLYERS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const flyer = await getFlyerById(id);
    if (!flyer) {
      return NextResponse.json({ error: "Flyer not found" }, { status: 404 });
    }

    // Delete file from disk
    try {
      await unlink(join(FLYERS_DIR, flyer.filename));
    } catch {
      // File may already be gone
    }

    await deleteFlyer(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Flyer API] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete flyer" }, { status: 500 });
  }
}
