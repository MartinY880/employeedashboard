// ProConnect — Props Comments API
// GET: Fetch comments (threaded) | POST: Add comment/reply | DELETE: Remove comment | PATCH: Like/unlike

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { createNotification } from "@/lib/notifications";
import { extractMentions, mentionDisplayLength, stripMentionMarkup } from "@/lib/mentions";
import { upsertHashtags, removeCommentHashtags } from "@/lib/hashtags";

export async function GET(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const propsId = searchParams.get("propsId");

    if (!propsId) {
      return NextResponse.json({ error: "propsId is required" }, { status: 400 });
    }

    // Resolve current user's DB id for likes + auth checks
    let currentUserId: string | null = null;
    if (isAuthenticated && user) {
      const dbUser = await prisma.user.findFirst({
        where: { logtoId: user.sub },
        select: { id: true },
      });
      currentUserId = dbUser?.id ?? null;
    }

    const comments = await prisma.propsComment.findMany({
      where: { propsId, parentId: null },
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
    if (currentUserId) {
      const allCommentIds = comments.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)]);
      if (allCommentIds.length > 0) {
        const likes = await prisma.propsCommentLike.findMany({
          where: { userId: currentUserId, commentId: { in: allCommentIds } },
          select: { commentId: true },
        });
        userLikedIds = new Set(likes.map((l) => l.commentId));
      }
    }

    const canDeleteAny = isAuthenticated && user?.role === "SUPER_ADMIN";

    // Enrich to UnifiedComment shape
    const enriched = comments.map((c) => ({
      id: c.id,
      authorId: c.authorId,
      authorName: c.author?.displayName ?? "Unknown",
      content: c.content,
      parentId: c.parentId,
      likes: c.likes,
      userLiked: userLikedIds.has(c.id),
      canDelete: canDeleteAny || (!!currentUserId && currentUserId === c.authorId),
      createdAt: c.createdAt,
      replies: c.replies.map((r) => ({
        id: r.id,
        authorId: r.authorId,
        authorName: r.author?.displayName ?? "Unknown",
        content: r.content,
        parentId: r.parentId,
        likes: r.likes,
        userLiked: userLikedIds.has(r.id),
        canDelete: canDeleteAny || (!!currentUserId && currentUserId === r.authorId),
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

    const dbUser = await prisma.user.findFirst({
      where: { logtoId: user.sub },
      select: { id: true, displayName: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { propsId, content, parentId } = body;

    if (!propsId || !content?.trim()) {
      return NextResponse.json({ error: "propsId and content are required" }, { status: 400 });
    }

    if (mentionDisplayLength(content.trim()) > 500) {
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
        authorId: dbUser.id,
        content: content.trim(),
        parentId: parentId || null,
      },
    });

    // Track hashtags
    await upsertHashtags(prisma, comment.id, "PROPS", content.trim());

    // ── Reply + @mention notifications ─────────────────────
    const commenterName = dbUser.displayName || "Someone";
    const plainContent = stripMentionMarkup(content.trim());

    const alreadyNotified = new Set<string>();
    alreadyNotified.add(dbUser.id);

    // Reply — notify parent comment author
    try {
      if (parentId) {
        const parentComment = await prisma.propsComment.findUnique({
          where: { id: parentId },
          select: { authorId: true },
        });
        if (parentComment && !alreadyNotified.has(parentComment.authorId)) {
          alreadyNotified.add(parentComment.authorId);
          await createNotification({
            recipientUserId: parentComment.authorId,
            type: "MENTION",
            title: "New reply on your comment",
            message: `${commenterName} replied to your comment on a Props post: "${plainContent}"`,
            metadata: { propsId, commentId: comment.id },
          });
        }
      }
    } catch (err) {
      console.error(`[PropsComments] Reply notification error for commentId=${comment.id}:`, err);
    }

    // @mention notifications
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

          if (!snapshot[0]) {
            continue;
          }

          const mentionEmail = (snapshot[0].mail || snapshot[0].userPrincipalName).toLowerCase();
          const recipientUser = await prisma.user.findFirst({
            where: { email: { equals: mentionEmail, mode: "insensitive" } },
            select: { id: true },
          });

          if (!recipientUser || alreadyNotified.has(recipientUser.id)) {
            continue;
          }

          alreadyNotified.add(recipientUser.id);
          await createNotification({
            recipientUserId: recipientUser.id,
            type: "MENTION",
            title: "You were mentioned in a comment",
            message: `${commenterName} mentioned you in a Props comment: "${plainContent}"`,
            metadata: { propsId, commentId: comment.id },
          });
        }
      }
    } catch (err) {
      console.error(`[PropsComments] Mention notification error for commentId=${comment.id}:`, err);
    }

    return NextResponse.json({ comment: { ...comment, authorName: dbUser.displayName, userLiked: false, canDelete: true, replies: [] } }, { status: 201 });
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

    const dbUser = await prisma.user.findFirst({
      where: { logtoId: user.sub },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { commentId } = body;

    if (!commentId) {
      return NextResponse.json({ error: "commentId is required" }, { status: 400 });
    }

    const existing = await prisma.propsCommentLike.findUnique({
      where: { commentId_userId: { commentId, userId: dbUser.id } },
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
      prisma.propsCommentLike.create({ data: { commentId, userId: dbUser.id } }),
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

    const dbUser = await prisma.user.findFirst({
      where: { logtoId: user.sub },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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

    const isAuthor = comment.authorId === dbUser.id;
    const isSuperAdmin = user.role === "SUPER_ADMIN";

    if (!isAuthor && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await removeCommentHashtags(prisma, id, "PROPS");
    await prisma.propsComment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
