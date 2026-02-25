// ProConnect — Notifications API Route
// GET: Fetch user notifications | PATCH: Mark as read | DELETE: Clear notifications

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";

// GET — fetch current user's notifications (with optional ?unreadOnly=true)
export async function GET(request: NextRequest) {
  const authResult = await getAuthUser();
  if (!authResult.isAuthenticated || !authResult.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the DB user by logtoId
  const dbUser = await prisma.user.findUnique({
    where: { logtoId: authResult.user.sub },
  });

  if (!dbUser) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const unreadOnly = request.nextUrl.searchParams.get("unreadOnly") === "true";

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: dbUser.id,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({
      where: { userId: dbUser.id, read: false },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

// PATCH — mark notifications as read
// Body: { ids: string[] } or { all: true }
export async function PATCH(request: NextRequest) {
  const authResult = await getAuthUser();
  if (!authResult.isAuthenticated || !authResult.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { logtoId: authResult.user.sub },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();

  if (body.all) {
    await prisma.notification.updateMany({
      where: { userId: dbUser.id, read: false },
      data: { read: true },
    });
  } else if (body.ids && Array.isArray(body.ids)) {
    await prisma.notification.updateMany({
      where: {
        id: { in: body.ids },
        userId: dbUser.id, // ensure user owns these notifications
      },
      data: { read: true },
    });
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: dbUser.id, read: false },
  });

  return NextResponse.json({ success: true, unreadCount });
}

// DELETE — clear all notifications for the user
export async function DELETE() {
  const authResult = await getAuthUser();
  if (!authResult.isAuthenticated || !authResult.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { logtoId: authResult.user.sub },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.notification.deleteMany({
    where: { userId: dbUser.id },
  });

  return NextResponse.json({ success: true });
}
