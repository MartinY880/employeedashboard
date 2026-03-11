// ProConnect — Idea Comments API
// GET: Fetch comments (threaded) | POST: Add comment/reply | DELETE: Remove comment | PATCH: Like/unlike

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { createNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const ideaId = searchParams.get("ideaId");

    if (!ideaId) {
      return NextResponse.json({ error: "ideaId is required" }, { status: 400 });
    }

    // Fetch top-level comments with their replies (one level deep)
    const comments = await prisma.ideaComment.findMany({
      where: { ideaId, parentId: null },
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
        const likes = await prisma.ideaCommentLike.findMany({
          where: { voterLogtoId: user.sub, commentId: { in: allCommentIds } },
          select: { commentId: true },
        });
        userLikedIds = new Set(likes.map((l) => l.commentId));
      }
    }

    const canDeleteAny = isAuthenticated && user?.role === "SUPER_ADMIN";

    // Enrich with userLiked + canDelete
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
    const { ideaId, content, parentId } = body;

    if (!ideaId || !content?.trim()) {
      return NextResponse.json({ error: "ideaId and content are required" }, { status: 400 });
    }

    if (content.trim().length > 500) {
      return NextResponse.json({ error: "Comment must be 500 characters or less" }, { status: 400 });
    }

    // If replying, verify parent exists and belongs to the same idea
    if (parentId) {
      const parent = await prisma.ideaComment.findFirst({ where: { id: parentId, ideaId } });
      if (!parent) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }
    }

    const comment = await prisma.ideaComment.create({
      data: {
        ideaId,
        authorId: user.sub,
        authorName: user.name || "Anonymous",
        content: content.trim(),
        parentId: parentId || null,
      },
    });

    // ── Email notifications ──────────────
    const commenterName = user.name || "Someone";
    const truncatedContent = content.trim().length > 120
      ? content.trim().slice(0, 120) + "…"
      : content.trim();

    try {
      // Look up the idea to get authorId + title
      const idea = await prisma.idea.findUnique({
        where: { id: ideaId },
        select: { authorId: true, authorName: true, title: true },
      });

      if (idea) {
        if (parentId) {
          // ── Reply: notify the parent comment's author ──
          const parentComment = await prisma.ideaComment.findUnique({
            where: { id: parentId },
            select: { authorId: true, authorName: true },
          });
          if (parentComment && parentComment.authorId !== user.sub) {
            const recipient = await prisma.user.findFirst({
              where: { logtoId: parentComment.authorId },
              select: { id: true },
            });
            if (recipient) {
              await createNotification({
                recipientUserId: recipient.id,
                type: "IDEA_REPLY",
                title: "New Reply to Your Comment",
                message: `${commenterName} replied to your comment on "${idea.title}": "${truncatedContent}"`,
                metadata: { ideaId, commentId: comment.id },
              });
            }
          }

          // Also notify idea author if different from both commenter and parent author
          if (idea.authorId !== user.sub && idea.authorId !== parentComment?.authorId) {
            const ideaOwner = await prisma.user.findFirst({
              where: { logtoId: idea.authorId },
              select: { id: true },
            });
            if (ideaOwner) {
              await createNotification({
                recipientUserId: ideaOwner.id,
                type: "IDEA_COMMENT",
                title: "New Comment on Your Idea",
                message: `${commenterName} commented on your idea "${idea.title}": "${truncatedContent}"`,
                metadata: { ideaId, commentId: comment.id },
              });
            }
          }
        } else {
          // ── Top-level comment: notify idea author ──
          if (idea.authorId !== user.sub) {
            const ideaOwner = await prisma.user.findFirst({
              where: { logtoId: idea.authorId },
              select: { id: true },
            });
            if (ideaOwner) {
              await createNotification({
                recipientUserId: ideaOwner.id,
                type: "IDEA_COMMENT",
                title: "New Comment on Your Idea",
                message: `${commenterName} commented on your idea "${idea.title}": "${truncatedContent}"`,
                metadata: { ideaId, commentId: comment.id },
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("[IdeaComments] Notification error:", err);
    }

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

    const existing = await prisma.ideaCommentLike.findUnique({
      where: { commentId_voterLogtoId: { commentId, voterLogtoId: user.sub } },
    });

    if (existing) {
      // Unlike
      await prisma.$transaction([
        prisma.ideaCommentLike.delete({ where: { id: existing.id } }),
        prisma.ideaComment.update({ where: { id: commentId }, data: { likes: { decrement: 1 } } }),
      ]);
      const updated = await prisma.ideaComment.findUnique({ where: { id: commentId }, select: { likes: true } });
      return NextResponse.json({ liked: false, likes: updated?.likes ?? 0 });
    } else {
      // Like
      await prisma.$transaction([
        prisma.ideaCommentLike.create({ data: { commentId, voterLogtoId: user.sub } }),
        prisma.ideaComment.update({ where: { id: commentId }, data: { likes: { increment: 1 } } }),
      ]);
      const updated = await prisma.ideaComment.findUnique({ where: { id: commentId }, select: { likes: true } });
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

    const comment = await prisma.ideaComment.findUnique({ where: { id } });
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Allow author or SUPER_ADMIN to delete
    const isAuthor = comment.authorId === user.sub;
    const isSuperAdmin = user.role === "SUPER_ADMIN";

    if (!isAuthor && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.ideaComment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
