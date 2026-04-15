// ProConnect — Celebration Comments API
// GET: Fetch comments (threaded) | POST: Add comment/reply | PATCH: Like/unlike | DELETE: Remove comment

import { NextResponse } from "next/server";
import { prisma, ensureDbUser } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { createNotification } from "@/lib/notifications";
import { extractMentions, mentionDisplayLength, stripMentionMarkup } from "@/lib/mentions";

export async function GET(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const celebrationId = searchParams.get("celebrationId");

    if (!celebrationId) {
      return NextResponse.json({ error: "celebrationId is required" }, { status: 400 });
    }

    const comments = await prisma.celebrationComment.findMany({
      where: { celebrationId, parentId: null },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { displayName: true } },
        replies: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { displayName: true } } },
        },
      },
    });

    let userLikedIds = new Set<string>();
    let currentDbUserId: string | null = null;

    if (isAuthenticated && user) {
      const dbUser = await prisma.user.findFirst({ where: { logtoId: user.sub }, select: { id: true } });
      currentDbUserId = dbUser?.id ?? null;

      if (currentDbUserId) {
        const allCommentIds = comments.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)]);
        if (allCommentIds.length > 0) {
          const likes = await prisma.celebrationCommentLike.findMany({
            where: { userId: currentDbUserId, commentId: { in: allCommentIds } },
            select: { commentId: true },
          });
          userLikedIds = new Set(likes.map((l) => l.commentId));
        }
      }
    }

    const canDeleteAny = isAuthenticated && user?.role === "SUPER_ADMIN";

    const enriched = comments.map((c) => ({
      id: c.id,
      authorId: c.authorId,
      authorName: c.author.displayName,
      content: c.content,
      parentId: c.parentId,
      likes: c.likes,
      userLiked: userLikedIds.has(c.id),
      canDelete: canDeleteAny || (!!currentDbUserId && currentDbUserId === c.authorId),
      createdAt: c.createdAt,
      replies: c.replies.map((r) => ({
        id: r.id,
        authorId: r.authorId,
        authorName: r.author.displayName,
        content: r.content,
        parentId: r.parentId,
        likes: r.likes,
        userLiked: userLikedIds.has(r.id),
        canDelete: canDeleteAny || (!!currentDbUserId && currentDbUserId === r.authorId),
        createdAt: r.createdAt,
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
    const { celebrationId, content, parentId } = body;

    if (!celebrationId || !content?.trim()) {
      return NextResponse.json({ error: "celebrationId and content are required" }, { status: 400 });
    }

    if (mentionDisplayLength(content.trim()) > 500) {
      return NextResponse.json({ error: "Comment must be 500 characters or less" }, { status: 400 });
    }

    if (parentId) {
      const parent = await prisma.celebrationComment.findFirst({ where: { id: parentId, celebrationId } });
      if (!parent) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }
    }

    const dbUser = await ensureDbUser(user.sub, user.email, user.name);

    const comment = await prisma.celebrationComment.create({
      data: {
        celebrationId,
        authorId: dbUser.id,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: { author: { select: { displayName: true } } },
    });

    // Increment denormalized comment count
    await prisma.celebrationEvent.update({
      where: { id: celebrationId },
      data: { commentCount: { increment: 1 } },
    });

    // ── Notifications (reply + @mention) ────────────────────
    const commenterName = user.name || "Someone";
    const plainContent = stripMentionMarkup(content.trim());
    const truncated = plainContent.length > 120 ? plainContent.slice(0, 120) + "…" : plainContent;
    const alreadyNotified = new Set<string>();
    alreadyNotified.add(dbUser.id); // never notify self

    // Look up the celebration event for context in the notification message
    const celebrationEvent = await prisma.celebrationEvent.findUnique({
      where: { id: celebrationId },
      select: { employeeName: true, type: true },
    });
    const subjectLabel = celebrationEvent
      ? `${celebrationEvent.employeeName}'s ${celebrationEvent.type}`
      : "a celebration";

    try {
      if (parentId) {
        // Reply — notify the parent comment's author
        const parentComment = await prisma.celebrationComment.findUnique({
          where: { id: parentId },
          select: { authorId: true },
        });
        if (parentComment && !alreadyNotified.has(parentComment.authorId)) {
          alreadyNotified.add(parentComment.authorId);
          await createNotification({
            recipientUserId: parentComment.authorId,
            type: "CELEBRATION_REPLY",
            title: "New reply on your comment",
            message: `${commenterName} replied to your comment on ${subjectLabel}: "${truncated}"`,
            metadata: { celebrationId, commentId: comment.id },
          });
        }
      }
    } catch (err) {
      console.error(`[CelebrationComments] Reply notification error for commentId=${comment.id}:`, err);
    }

    // ── @mention notifications ─────────────────────────────
    try {
      const mentions = extractMentions(content.trim());
      if (mentions.length > 0) {
        for (const mention of mentions) {
          const snapshot = await prisma.$queryRaw<
            { mail: string | null; userPrincipalName: string }[]
          >`
            SELECT mail, user_principal_name AS "userPrincipalName"
            FROM directory_snapshots WHERE id = ${mention.userId} LIMIT 1
          `;
          if (!snapshot[0]) continue;

          const mentionEmail = (snapshot[0].mail || snapshot[0].userPrincipalName).toLowerCase();
          const recipientUser = await prisma.user.findFirst({
            where: { email: { equals: mentionEmail, mode: "insensitive" } },
            select: { id: true },
          });
          if (!recipientUser || alreadyNotified.has(recipientUser.id)) continue;

          alreadyNotified.add(recipientUser.id);
          await createNotification({
            recipientUserId: recipientUser.id,
            type: "MENTION",
            title: "You were mentioned in a comment",
            message: `${commenterName} mentioned you in a Celebrations comment: "${truncated}"`,
            metadata: { celebrationId, commentId: comment.id },
          });
        }
      }
    } catch (err) {
      console.error(`[CelebrationComments] Mention notification error for commentId=${comment.id}:`, err);
    }

    return NextResponse.json(
      { comment: { ...comment, authorName: comment.author.displayName, userLiked: false, canDelete: true, replies: [] } },
      { status: 201 },
    );
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

    // userId on celebration_comment_likes stores DB User.id
    const dbUser = await prisma.user.findFirst({ where: { logtoId: user.sub }, select: { id: true } });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = await prisma.celebrationCommentLike.findUnique({
      where: { commentId_userId: { commentId, userId: dbUser.id } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.celebrationCommentLike.delete({ where: { id: existing.id } }),
        prisma.celebrationComment.update({ where: { id: commentId }, data: { likes: { decrement: 1 } } }),
      ]);
      const updated = await prisma.celebrationComment.findUnique({ where: { id: commentId }, select: { likes: true } });
      return NextResponse.json({ liked: false, likes: updated?.likes ?? 0 });
    } else {
      await prisma.$transaction([
        prisma.celebrationCommentLike.create({ data: { commentId, userId: dbUser.id } }),
        prisma.celebrationComment.update({ where: { id: commentId }, data: { likes: { increment: 1 } } }),
      ]);
      const updated = await prisma.celebrationComment.findUnique({ where: { id: commentId }, select: { likes: true } });
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

    const comment = await prisma.celebrationComment.findUnique({ where: { id } });
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const currentDbUser = await prisma.user.findFirst({ where: { logtoId: user.sub }, select: { id: true } });
    const isAuthor = currentDbUser ? comment.authorId === currentDbUser.id : false;
    const isSuperAdmin = user.role === "SUPER_ADMIN";

    if (!isAuthor && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Count replies to decrement comment count accurately
    const replyCount = await prisma.celebrationComment.count({ where: { parentId: id } });

    await prisma.$transaction([
      prisma.celebrationComment.delete({ where: { id } }),
      prisma.celebrationEvent.update({
        where: { id: comment.celebrationId },
        data: { commentCount: { decrement: 1 + replyCount } },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
