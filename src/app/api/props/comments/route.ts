// ProConnect — Props Comments API
// GET: Fetch comments (threaded) | POST: Add comment/reply | DELETE: Remove comment | PATCH: Like/unlike

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";

export async function GET(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const propsId = searchParams.get("propsId");

    if (!propsId) {
      return NextResponse.json({ error: "propsId is required" }, { status: 400 });
    }

    const comments = await prisma.propsComment.findMany({
      where: { propsId, parentId: null },
      orderBy: { createdAt: "asc" },
      include: {
        replies: { orderBy: { createdAt: "asc" } },
      },
    });

    let userLikedIds = new Set<string>();
    if (isAuthenticated && user) {
      const allCommentIds = comments.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)]);
      if (allCommentIds.length > 0) {
        const likes = await prisma.propsCommentLike.findMany({
          where: { voterLogtoId: user.sub, commentId: { in: allCommentIds } },
          select: { commentId: true },
        });
        userLikedIds = new Set(likes.map((l) => l.commentId));
      }
    }

    const canDeleteAny = isAuthenticated && user?.role === "SUPER_ADMIN";

    const enriched = comments.map((c) => ({
      ...c,
      userLiked: userLikedIds.has(c.id),
      canDelete: canDeleteAny || (isAuthenticated && user?.sub === c.authorId),
      replies: c.replies.map((r) => ({
        ...r,
        userLiked: userLikedIds.has(r.id),
        canDelete: canDeleteAny || (isAuthenticated && user?.sub === r.authorId),
        replies: [],
      })),
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
    const { propsId, content, parentId } = body;

    if (!propsId || !content?.trim()) {
      return NextResponse.json({ error: "propsId and content are required" }, { status: 400 });
    }

    if (content.trim().length > 500) {
      return NextResponse.json({ error: "Comment must be 500 characters or less" }, { status: 400 });
    }

    if (parentId) {
      const parent = await prisma.propsComment.findFirst({ where: { id: parentId, propsId } });
      if (!parent) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }
    }

    const comment = await prisma.propsComment.create({
      data: {
        propsId,
        authorId: user.sub,
        authorName: user.name || "Anonymous",
        content: content.trim(),
        parentId: parentId || null,
      },
    });

    return NextResponse.json({ comment: { ...comment, userLiked: false, canDelete: true, replies: [] } }, { status: 201 });
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

    const existing = await prisma.propsCommentLike.findUnique({
      where: { commentId_voterLogtoId: { commentId, voterLogtoId: user.sub } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.propsCommentLike.delete({ where: { id: existing.id } }),
        prisma.propsComment.update({ where: { id: commentId }, data: { likes: { decrement: 1 } } }),
      ]);
      const updated = await prisma.propsComment.findUnique({ where: { id: commentId }, select: { likes: true } });
      return NextResponse.json({ liked: false, likes: updated?.likes ?? 0 });
    }

    await prisma.$transaction([
      prisma.propsCommentLike.create({ data: { commentId, voterLogtoId: user.sub } }),
      prisma.propsComment.update({ where: { id: commentId }, data: { likes: { increment: 1 } } }),
    ]);
    const updated = await prisma.propsComment.findUnique({ where: { id: commentId }, select: { likes: true } });
    return NextResponse.json({ liked: true, likes: updated?.likes ?? 0 });
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

    const comment = await prisma.propsComment.findUnique({ where: { id } });
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const isAuthor = comment.authorId === user.sub;
    const isSuperAdmin = user.role === "SUPER_ADMIN";

    if (!isAuthor && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.propsComment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
