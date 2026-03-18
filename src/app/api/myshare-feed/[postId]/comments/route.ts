// ProConnect — MyShare Comments API
// GET: Fetch comments for a post | POST: Add comment | PATCH: Like comment | DELETE: Remove comment

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function GET(
  request: Request,
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
    const currentUserId = dbUser?.id;

    const comments = await prisma.myShareComment.findMany({
      where: { postId, parentId: null, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
        _count: { select: { likedBy: true } },
        likedBy: currentUserId
          ? { where: { userId: currentUserId }, select: { id: true } }
          : false,
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, displayName: true, email: true } },
            _count: { select: { likedBy: true } },
            likedBy: currentUserId
              ? { where: { userId: currentUserId }, select: { id: true } }
              : false,
          },
        },
      },
    });

    const formatted = comments.map((c) => formatComment(c, currentUserId));

    return NextResponse.json({ comments: formatted });
  } catch (err) {
    console.error("[MyShare Comments GET]", err);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = await params;
    const body = await request.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const parentId = body.parentId || null;

    if (!content || content.length > 1000) {
      return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { logtoId: user.sub },
      select: { id: true, displayName: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const comment = await prisma.myShareComment.create({
      data: {
        postId,
        authorId: dbUser.id,
        content,
        parentId,
      },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
      },
    });

    // Send notification to the post author (or parent comment author for replies)
    try {
      if (parentId) {
        // Reply — notify the parent comment author
        const parentComment = await prisma.myShareComment.findUnique({
          where: { id: parentId },
          select: { authorId: true },
        });
        if (parentComment && parentComment.authorId !== dbUser.id) {
          void createNotification({
            recipientUserId: parentComment.authorId,
            type: "MYSHARE_REPLY",
            title: "New reply on your comment",
            message: `${dbUser.displayName} replied to your comment.`,
            metadata: { postId },
          });
        }
      } else {
        // Top-level comment — notify the post author
        const post = await prisma.mySharePost.findUnique({
          where: { id: postId },
          select: { authorId: true },
        });
        if (post && post.authorId !== dbUser.id) {
          void createNotification({
            recipientUserId: post.authorId,
            type: "MYSHARE_COMMENT",
            title: "New comment on your post",
            message: `${dbUser.displayName} commented on your post.`,
            metadata: { postId },
          });
        }
      }
    } catch (notifErr) {
      console.error("[MyShare Comments] Notification error:", notifErr);
    }

    return NextResponse.json({
      comment: {
        id: comment.id,
        postId: comment.postId,
        authorId: comment.author.id,
        authorEmail: comment.author.email,
        authorName: comment.author.displayName,
        content: comment.content,
        parentId: comment.parentId,
        likes: 0,
        userLiked: false,
        canDelete: true,
        createdAt: comment.createdAt.toISOString(),
        replies: [],
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[MyShare Comments POST]", err);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await params; // consume params

    const body = await request.json();
    const commentId = body.commentId;
    if (!commentId) {
      return NextResponse.json({ error: "Missing commentId" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { logtoId: user.sub },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = await prisma.myShareCommentLike.findUnique({
      where: { commentId_userId: { commentId, userId: dbUser.id } },
    });

    if (existing) {
      await prisma.myShareCommentLike.delete({ where: { id: existing.id } });
      return NextResponse.json({ liked: false });
    }

    await prisma.myShareCommentLike.create({
      data: { commentId, userId: dbUser.id },
    });

    return NextResponse.json({ liked: true });
  } catch (err) {
    console.error("[MyShare Comment Like]", err);
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await params;

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("id");
    if (!commentId) {
      return NextResponse.json({ error: "Missing comment id" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { logtoId: user.sub },
      select: { id: true },
    });

    const comment = await prisma.myShareComment.findUnique({
      where: { id: commentId, deletedAt: null },
      select: { authorId: true },
    });

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const isAuthor = comment.authorId === dbUser?.id;
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.myShareComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[MyShare Comment DELETE]", err);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatComment(c: any, currentUserId?: string) {
  return {
    id: c.id,
    postId: c.postId,
    authorId: c.author.id,
    authorEmail: c.author.email,
    authorName: c.author.displayName,
    content: c.content,
    parentId: c.parentId,
    likes: c._count.likedBy,
    userLiked: Array.isArray(c.likedBy) && c.likedBy.length > 0,
    canDelete: c.author.id === currentUserId,
    createdAt: c.createdAt.toISOString(),
    replies: (c.replies || []).map((r: any) => formatComment(r, currentUserId)),
  };
}
