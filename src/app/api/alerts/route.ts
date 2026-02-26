// ProConnect — Alerts API Route
// GET: Fetch active alerts | POST: Create alert (admin)

import { NextResponse } from "next/server";
import { prisma, ensureDbUser } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS, toDbRole } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") !== "false";
    const countOnly = searchParams.get("count") === "true";

    if (countOnly) {
      const count = await prisma.alert.count({
        where: activeOnly ? { active: true } : undefined,
      });
      return NextResponse.json({ count });
    }

    const alerts = await prisma.alert.findMany({
      where: activeOnly ? { active: true } : undefined,
      include: {
        author: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
      take: 50,
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("[Alerts API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await getAuthUser();
    if (!authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(authResult.user, PERMISSIONS.MANAGE_ALERTS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, content } = body;
    const type = body.type as "INFO" | "WARNING" | "BIRTHDAY" | "NEW_HIRE" | "ANNOUNCEMENT" | undefined;
    const priority = body.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const user = authResult.user;
    const dbUser = await ensureDbUser(
      user.sub,
      user.email,
      user.name,
      toDbRole(user.role),
    );

    const alert = await prisma.alert.create({
      data: {
        title,
        content,
        type: type || "INFO",
        priority: priority || "LOW",
        createdBy: dbUser.id,
      },
      include: {
        author: {
          select: { id: true, displayName: true },
        },
      },
    });

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    console.error("[Alerts API] POST error:", error);
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_ALERTS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "Alert id is required" }, { status: 400 });
    }

    // Only allow updating specific fields
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.active !== undefined) updateData.active = data.active;

    const alert = await prisma.alert.update({
      where: { id: id as string },
      data: updateData,
      include: {
        author: { select: { id: true, displayName: true } },
      },
    });

    return NextResponse.json({ alert });
  } catch (error) {
    console.error("[Alerts API] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_ALERTS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Alert id is required" }, { status: 400 });
    }

    await prisma.alert.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Alerts API] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }
}
