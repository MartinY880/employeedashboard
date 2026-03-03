// ProConnect — Video Spotlight Comments API
// GET: Fetch comments (threaded) | POST: Add comment/reply | DELETE: Remove comment | PATCH: Like/unlike

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");

    if (!videoId) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    // Fetch top-level comments with their replies (one level deep)
    const comments = await prisma.videoSpotlightComment.findMany({
      where: { videoId, parentId: null },
      orderBy: { createdAt: "asc" },
      include: {
        replies: { orderBy: { createdAt: "asc" } },
      },
    });

    // Get user's likes if authenticated
    let userLikedIds = new Set<string>();
    if (isAuthenticated && user) {
      const allCommentIds = comments.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)]);
      if (allCommentIds.length > 0) {
        const likes = await prisma.videoSpotlightCommentLike.findMany({
          where: { voterLogtoId: user.sub, commentId: { in: allCommentIds } },
          select: { commentId: true },
        });
        userLikedIds = new Set(likes.map((l) => l.commentId));
      }
    }

    // Enrich with userLiked
    const enriched = comments.map((c) => ({
      ...c,
      userLiked: userLikedIds.has(c.id),
      replies: c.replies.map((r) => ({ ...r, userLiked: userLikedIds.has(r.id), replies: [] })),
    }));

    return NextResponse.json({ comments: enriched });
  } catch {
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { videoId, content, parentId } = body;

    if (!videoId || !content?.trim()) {
      return NextResponse.json({ error: "videoId and content are required" }, { status: 400 });
    }

    if (content.trim().length > 500) {
      return NextResponse.json({ error: "Comment must be 500 characters or less" }, { status: 400 });
    }

    // If replying, verify parent exists and belongs to the same video
    if (parentId) {
      const parent = await prisma.videoSpotlightComment.findFirst({ where: { id: parentId, videoId } });
      if (!parent) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }
    }

    const comment = await prisma.videoSpotlightComment.create({
      data: {
        videoId,
        authorId: user.sub,
        authorName: user.name || "Anonymous",
        content: content.trim(),
        parentId: parentId || null,
      },
    });

    return NextResponse.json({ comment: { ...comment, userLiked: false, replies: [] } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { commentId } = body;

    if (!commentId) {
      return NextResponse.json({ error: "commentId is required" }, { status: 400 });
    }

    const existing = await prisma.videoSpotlightCommentLike.findUnique({
      where: { commentId_voterLogtoId: { commentId, voterLogtoId: user.sub } },
    });

    if (existing) {
      // Unlike
      await prisma.$transaction([
        prisma.videoSpotlightCommentLike.delete({ where: { id: existing.id } }),
        prisma.videoSpotlightComment.update({ where: { id: commentId }, data: { likes: { decrement: 1 } } }),
      ]);
      const updated = await prisma.videoSpotlightComment.findUnique({ where: { id: commentId }, select: { likes: true } });
      return NextResponse.json({ liked: false, likes: updated?.likes ?? 0 });
    } else {
      // Like
      await prisma.$transaction([
        prisma.videoSpotlightCommentLike.create({ data: { commentId, voterLogtoId: user.sub } }),
        prisma.videoSpotlightComment.update({ where: { id: commentId }, data: { likes: { increment: 1 } } }),
      ]);
      const updated = await prisma.videoSpotlightComment.findUnique({ where: { id: commentId }, select: { likes: true } });
      return NextResponse.json({ liked: true, likes: updated?.likes ?? 0 });
    }
  } catch {
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const comment = await prisma.videoSpotlightComment.findUnique({ where: { id } });
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Allow author or admin to delete
    const isAuthor = comment.authorId === user.sub;
    const isAdmin = hasPermission(user, PERMISSIONS.MANAGE_VIDEO_SPOTLIGHT);

    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.videoSpotlightComment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
