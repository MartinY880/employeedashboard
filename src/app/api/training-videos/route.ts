// ProConnect — Training Videos API
// GET (public): active videos ordered by featured desc, sortOrder asc
// POST/PUT/DELETE/PATCH: admin CRUD + reorder (MANAGE_TRAINING_VIDEOS permission)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

// ─── Public GET ───────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";

    const videos = await prisma.trainingVideo.findMany({
      where: all ? {} : { active: true },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json({ videos });
  } catch (err) {
    console.error("[Training Videos] GET error:", err);
    return NextResponse.json({ videos: [] });
  }
}

// ─── Admin POST (create) ──────────────────────────────────

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_TRAINING_VIDEOS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const zoomUrl = String(body.zoomUrl ?? "").trim();

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!zoomUrl) return NextResponse.json({ error: "Zoom URL is required" }, { status: 400 });

    const count = await prisma.trainingVideo.count();

    const video = await prisma.trainingVideo.create({
      data: {
        title,
        zoomUrl,
        description: body.description ? String(body.description).trim() : null,
        presenter: body.presenter ? String(body.presenter).trim() : null,
        category: body.category ? String(body.category).trim() : "General",
        thumbnailUrl: body.thumbnailUrl ? String(body.thumbnailUrl).trim() : null,
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : null,
        sortOrder: count,
        featured: body.featured === true,
        active: body.active !== false,
      },
    });

    return NextResponse.json({ video }, { status: 201 });
  } catch (err) {
    console.error("[Training Videos] POST error:", err);
    return NextResponse.json({ error: "Failed to create training video" }, { status: 500 });
  }
}

// ─── Admin PATCH (reorder) ────────────────────────────────
// Body: { order: [{ id, sortOrder }] }

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_TRAINING_VIDEOS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const order = body.order;
    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: "order array is required" }, { status: 400 });
    }

    const updates = order
      .filter((item: unknown) => {
        if (!item || typeof item !== "object") return false;
        const obj = item as Record<string, unknown>;
        return typeof obj.id === "string" && typeof obj.sortOrder === "number";
      })
      .map((item: { id: string; sortOrder: number }) => ({ id: item.id, sortOrder: item.sortOrder }));

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid entries in order array" }, { status: 400 });
    }

    await prisma.$transaction(
      updates.map((u) =>
        prisma.trainingVideo.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } })
      )
    );

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (err) {
    console.error("[Training Videos] PATCH reorder error:", err);
    return NextResponse.json({ error: "Failed to reorder videos" }, { status: 500 });
  }
}
