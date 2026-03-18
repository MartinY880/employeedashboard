// ProConnect — MyShare Like API
// POST: Toggle like on a myshare post

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = await params;

    const dbUser = await prisma.user.findUnique({
      where: { logtoId: user.sub },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = await prisma.myShareLike.findUnique({
      where: { postId_userId: { postId, userId: dbUser.id } },
    });

    if (existing) {
      await prisma.myShareLike.delete({ where: { id: existing.id } });
      return NextResponse.json({ liked: false });
    }

    await prisma.myShareLike.create({
      data: { postId, userId: dbUser.id },
    });

    return NextResponse.json({ liked: true });
  } catch (err) {
    console.error("[MyShare Like]", err);
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}
