// ProConnect — Celebration Like API
// POST: Toggle like on a celebration event

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { celebrationId } = await request.json();
    if (!celebrationId || typeof celebrationId !== "string") {
      return NextResponse.json({ error: "celebrationId is required" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { logtoId: user.sub },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = await prisma.celebrationLike.findUnique({
      where: { celebrationId_userId: { celebrationId, userId: dbUser.id } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.celebrationLike.delete({ where: { id: existing.id } }),
        prisma.celebrationEvent.update({
          where: { id: celebrationId },
          data: { likeCount: { decrement: 1 } },
        }),
      ]);
      return NextResponse.json({ liked: false });
    }

    await prisma.$transaction([
      prisma.celebrationLike.create({
        data: { celebrationId, userId: dbUser.id },
      }),
      prisma.celebrationEvent.update({
        where: { id: celebrationId },
        data: { likeCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ liked: true });
  } catch (err) {
    console.error("[Celebration Like]", err);
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}
