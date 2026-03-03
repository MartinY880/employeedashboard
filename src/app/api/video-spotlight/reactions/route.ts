// ProConnect — Video Spotlight Reactions API
// GET: Fetch reaction counts + user reaction | POST: Toggle like/dislike

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";

export async function GET(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");

    if (!videoId) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    const [likes, dislikes] = await Promise.all([
      prisma.videoSpotlightReaction.count({ where: { videoId, type: "like" } }),
      prisma.videoSpotlightReaction.count({ where: { videoId, type: "dislike" } }),
    ]);

    let userReaction: string | null = null;
    if (isAuthenticated && user) {
      const existing = await prisma.videoSpotlightReaction.findUnique({
        where: { videoId_userLogtoId: { videoId, userLogtoId: user.sub } },
      });
      userReaction = existing?.type ?? null;
    }

    return NextResponse.json({ likes, dislikes, userReaction });
  } catch {
    return NextResponse.json({ error: "Failed to fetch reactions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { videoId, type } = body;

    if (!videoId || !["like", "dislike"].includes(type)) {
      return NextResponse.json({ error: "videoId and type (like|dislike) required" }, { status: 400 });
    }

    const existing = await prisma.videoSpotlightReaction.findUnique({
      where: { videoId_userLogtoId: { videoId, userLogtoId: user.sub } },
    });

    if (existing) {
      if (existing.type === type) {
        // Same reaction → remove (toggle off)
        await prisma.videoSpotlightReaction.delete({ where: { id: existing.id } });
      } else {
        // Different reaction → switch
        await prisma.videoSpotlightReaction.update({
          where: { id: existing.id },
          data: { type },
        });
      }
    } else {
      // No existing → create
      await prisma.videoSpotlightReaction.create({
        data: { videoId, userLogtoId: user.sub, type },
      });
    }

    // Return updated counts
    const [likes, dislikes] = await Promise.all([
      prisma.videoSpotlightReaction.count({ where: { videoId, type: "like" } }),
      prisma.videoSpotlightReaction.count({ where: { videoId, type: "dislike" } }),
    ]);

    const updated = await prisma.videoSpotlightReaction.findUnique({
      where: { videoId_userLogtoId: { videoId, userLogtoId: user.sub } },
    });

    return NextResponse.json({ likes, dislikes, userReaction: updated?.type ?? null });
  } catch {
    return NextResponse.json({ error: "Failed to toggle reaction" }, { status: 500 });
  }
}
