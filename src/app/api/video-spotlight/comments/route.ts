// ProConnect — Video Spotlight Comments API
// GET: Fetch comments (threaded) | POST: Add comment/reply | DELETE: Remove comment | PATCH: Like/unlike

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDbUser } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { toDbRole } from "@/lib/rbac";
import { createNotification } from "@/lib/notifications";
import { extractMentions, mentionDisplayLength, stripMentionMarkup } from "@/lib/mentions";
import { upsertHashtags, removeCommentHashtags } from "@/lib/hashtags";

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
        author: { select: { displayName: true } },
        replies: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { displayName: true } } },
        },
      },
    });

    // Resolve current user's DB id + admin status for canDelete checks
    let userLikedIds = new Set<string>();
    let currentUserId: string | null = null;
    let canDeleteAny = false;
    if (isAuthenticated && user) {
      const dbUser = await ensureDbUser(
        user.sub,
        user.email ?? "",
        user.name ?? user.email ?? "Unknown",
        toDbRole(user.role)
      );
      currentUserId = dbUser.id;
      canDeleteAny = hasPermission(user, PERMISSIONS.MANAGE_VIDEO_SPOTLIGHT);
      const allCommentIds = comments.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)]);
      if (allCommentIds.length > 0) {
        const likes = await prisma.videoSpotlightCommentLike.findMany({
          where: { userId: dbUser.id, commentId: { in: allCommentIds } },
          select: { commentId: true },
        });
        userLikedIds = new Set(likes.map((l) => l.commentId));
      }
    }

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

    const dbUser = await ensureDbUser(
      user.sub,
      user.email ?? "",
      user.name ?? user.email ?? "Unknown",
      toDbRole(user.role)
    );

    const body = await request.json();
    const { videoId, content, parentId } = body;

    if (!videoId || !content?.trim()) {
      return NextResponse.json({ error: "videoId and content are required" }, { status: 400 });
    }

    if (content.trim().length > 500 || mentionDisplayLength(content.trim()) > 500) {
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
        authorId: dbUser.id,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: { author: { select: { displayName: true } } },
    });

    await upsertHashtags(prisma, comment.id, "VIDEO", content.trim());

    // ── Reply + @mention notifications ─────────────────────
    const commenterName = user.name || "Someone";
    const plainContent = stripMentionMarkup(content.trim());
    const alreadyNotified = new Set<string>();
    alreadyNotified.add(dbUser.id);

    // Reply — notify parent comment author
    try {
      if (parentId) {
        const parentComment = await prisma.videoSpotlightComment.findUnique({
          where: { id: parentId },
          select: { authorId: true },
        });
        if (parentComment && !alreadyNotified.has(parentComment.authorId)) {
          alreadyNotified.add(parentComment.authorId);
          await createNotification({
            recipientUserId: parentComment.authorId,
            type: "MENTION",
            title: "New reply on your comment",
            message: `${commenterName} replied to your comment on a Video Spotlight: "${plainContent}"`,
            metadata: { videoId, commentId: comment.id },
          });
        }
      }
    } catch (err) {
      console.error(`[VideoSpotlightComments] Reply notification error for commentId=${comment.id}:`, err);
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
            message: `${commenterName} mentioned you in a Video Spotlight comment: "${plainContent}"`,
            metadata: { videoId, commentId: comment.id },
          });
        }
      }
    } catch (err) {
      console.error(`[VideoSpotlightComments] Mention notification error for commentId=${comment.id}:`, err);
    }

    return NextResponse.json(
      {
        comment: {
          ...comment,
          authorName: comment.author?.displayName ?? "Unknown",
          author: undefined,
          userLiked: false,
          replies: [],
        },
      },
      { status: 201 }
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

    const dbUser = await ensureDbUser(
      user.sub,
      user.email ?? "",
      user.name ?? user.email ?? "Unknown",
      toDbRole(user.role)
    );

    const body = await request.json();
    const { commentId } = body;

    if (!commentId) {
      return NextResponse.json({ error: "commentId is required" }, { status: 400 });
    }

    const existing = await prisma.videoSpotlightCommentLike.findUnique({
      where: { commentId_userId: { commentId, userId: dbUser.id } },
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
        prisma.videoSpotlightCommentLike.create({ data: { commentId, userId: dbUser.id } }),
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

    const dbUser = await ensureDbUser(
      user.sub,
      user.email ?? "",
      user.name ?? user.email ?? "Unknown",
      toDbRole(user.role)
    );

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
    const isAuthor = comment.authorId === dbUser.id;
    const isAdmin = hasPermission(user, PERMISSIONS.MANAGE_VIDEO_SPOTLIGHT);

    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await removeCommentHashtags(prisma, id, "VIDEO");
    await prisma.videoSpotlightComment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
