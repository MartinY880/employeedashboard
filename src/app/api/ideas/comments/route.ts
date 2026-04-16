// ProConnect — Idea Comments API
// GET: Fetch comments (threaded) | POST: Add comment/reply | DELETE: Remove comment | PATCH: Like/unlike

import { NextResponse } from "next/server";
import { prisma, ensureDbUser } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { createNotification } from "@/lib/notifications";
import { extractMentions, mentionDisplayLength, stripMentionMarkup } from "@/lib/mentions";
import { upsertHashtags, removeCommentHashtags } from "@/lib/hashtags";

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
        author: { select: { displayName: true } },
        replies: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { displayName: true } } },
        },
      },
    });

    const canDeleteAny = isAuthenticated && user?.role === "SUPER_ADMIN";

    // Resolve current user's DB id for ownership checks + likes
    let currentDbUserId: string | null = null;
    if (isAuthenticated && user) {
      const dbUser = await prisma.user.findFirst({ where: { logtoId: user.sub }, select: { id: true } });
      currentDbUserId = dbUser?.id ?? null;
    }

    // Get user's likes if authenticated
    let userLikedIds = new Set<string>();
    if (currentDbUserId) {
      const allCommentIds = comments.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)]);
      if (allCommentIds.length > 0) {
        const likes = await prisma.ideaCommentLike.findMany({
          where: { userId: currentDbUserId, commentId: { in: allCommentIds } },
          select: { commentId: true },
        });
        userLikedIds = new Set(likes.map((l) => l.commentId));
      }
    }

    // Enrich to UnifiedComment shape
    const enriched = comments.map((c) => ({
      id: c.id,
      authorId: c.userId,
      authorName: c.author?.displayName ?? "Anonymous",
      content: c.content,
      parentId: c.parentId,
      likes: c.likes,
      userLiked: userLikedIds.has(c.id),
      canDelete: canDeleteAny || (!!currentDbUserId && currentDbUserId === c.userId),
      createdAt: c.createdAt,
      replies: c.replies.map((r) => ({
        id: r.id,
        authorId: r.userId,
        authorName: r.author?.displayName ?? "Anonymous",
        content: r.content,
        parentId: r.parentId,
        likes: r.likes,
        userLiked: userLikedIds.has(r.id),
        canDelete: canDeleteAny || (!!currentDbUserId && currentDbUserId === r.userId),
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
    const { ideaId, content, parentId } = body;

    if (!ideaId || !content?.trim()) {
      return NextResponse.json({ error: "ideaId and content are required" }, { status: 400 });
    }

    if (mentionDisplayLength(content.trim()) > 500) {
      return NextResponse.json({ error: "Comment must be 500 characters or less" }, { status: 400 });
    }

    // If replying, verify parent exists and belongs to the same idea
    if (parentId) {
      const parent = await prisma.ideaComment.findFirst({ where: { id: parentId, ideaId } });
      if (!parent) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }
    }

    // Resolve DB user ID for authorId (instead of storing logtoId)
    const dbUser = await ensureDbUser(user.sub, user.email, user.name);

    const comment = await prisma.ideaComment.create({
      data: {
        ideaId,
        userId: dbUser.id,
        content: content.trim(),
        parentId: parentId || null,
      },
    });

    await upsertHashtags(prisma, comment.id, "IDEA", content.trim());

    // ── Email notifications ──────────────
    const commenterName = user.name || "Someone";
    const plainContent = stripMentionMarkup(content.trim());

    const logCtx = { ideaId, commentId: comment.id, parentId: parentId || null, commenter: dbUser.id, commenterName };
    console.log(`[IdeaComments] Starting email notifications`, JSON.stringify(logCtx));

    // Track who actually receives a notification in the comment/reply block
    // so the @mention block can skip them (no double emails)
    const alreadyNotified = new Set<string>();
    alreadyNotified.add(dbUser.id); // never notify self

    try {
      // Look up the idea to get userId (DB User.id) + title
      const idea = await prisma.idea.findUnique({
        where: { id: ideaId },
        select: { userId: true, title: true },
      });

      if (!idea) {
        console.warn(`[IdeaComments] Idea ${ideaId} not found — skipping all email notifications`);
      } else if (parentId) {
          // ── Reply: notify the parent comment's author ──
          const parentComment = await prisma.ideaComment.findUnique({
            where: { id: parentId },
            select: { userId: true },
          });
          if (!parentComment) {
            console.warn(`[IdeaComments] Parent comment ${parentId} not found — skipping reply notification`);
          } else if (parentComment.userId === dbUser.id) {
            console.log(`[IdeaComments] Commenter is parent comment author (${dbUser.id}) — skipping reply notification`);
          } else {
            console.log(`[IdeaComments] Sending IDEA_REPLY notification to userId=${parentComment.userId}`);
            await createNotification({
              recipientUserId: parentComment.userId,
              type: "IDEA_REPLY",
              title: "New Reply to Your Comment",
              message: `${commenterName} replied to your comment on "${idea.title}": "${plainContent}"`,
              metadata: { ideaId, commentId: comment.id },
            });
            alreadyNotified.add(parentComment.userId);
          }

          // Also notify idea author if different from both commenter and parent author
          if (idea.userId === dbUser.id) {
            console.log(`[IdeaComments] Commenter is idea author (${dbUser.id}) — skipping idea-owner notification`);
          } else if (idea.userId === parentComment?.userId) {
            console.log(`[IdeaComments] Idea author same as parent comment author (${idea.userId}) — already notified, skipping`);
          } else if (idea.userId === "anonymous") {
            console.log(`[IdeaComments] Idea author is anonymous — skipping idea-owner notification`);
          } else {
            console.log(`[IdeaComments] Sending IDEA_COMMENT notification to userId=${idea.userId}`);
            await createNotification({
              recipientUserId: idea.userId,
              type: "IDEA_COMMENT",
              title: "New Comment on Your Idea",
              message: `${commenterName} commented on your idea "${idea.title}": "${plainContent}"`,
              metadata: { ideaId, commentId: comment.id },
            });
            alreadyNotified.add(idea.userId);
          }
        } else {
          // ── Top-level comment: notify idea author ──
          if (idea.userId === dbUser.id) {
            console.log(`[IdeaComments] Commenter is idea author (${dbUser.id}) — skipping self-notification`);
          } else if (idea.userId === "anonymous") {
            console.log(`[IdeaComments] Idea author is anonymous — skipping notification`);
          } else {
            console.log(`[IdeaComments] Sending IDEA_COMMENT notification to userId=${idea.userId}`);
            await createNotification({
              recipientUserId: idea.userId,
              type: "IDEA_COMMENT",
              title: "New Comment on Your Idea",
              message: `${commenterName} commented on your idea "${idea.title}": "${plainContent}"`,
              metadata: { ideaId, commentId: comment.id },
            });
            alreadyNotified.add(idea.userId);
          }
        }
    } catch (err) {
      console.error(`[IdeaComments] Notification error for ideaId=${ideaId} commentId=${comment.id}:`, err);
    }

    try {
      const mentions = extractMentions(content.trim());
      if (mentions.length > 0) {
        const mentionDisplay = stripMentionMarkup(content.trim());

        for (const mention of mentions) {
          const snapshot = await prisma.$queryRaw<
            { mail: string | null; userPrincipalName: string }[]
          >`
            SELECT mail, user_principal_name AS "userPrincipalName"
            FROM directory_snapshots WHERE id = ${mention.userId} LIMIT 1
          `;

          if (!snapshot[0]) {
            console.log(`[IdeaComments] Mention: userId=${mention.userId} (${mention.displayName}) not found in directory — skipping`);
            continue;
          }

          const mentionEmail = (snapshot[0].mail || snapshot[0].userPrincipalName).toLowerCase();
          const recipientUser = await prisma.user.findFirst({
            where: { email: { equals: mentionEmail, mode: "insensitive" } },
            select: { id: true },
          });

          if (!recipientUser) {
            console.log(`[IdeaComments] Mention: no DB user for email=${mentionEmail} — skipping`);
            continue;
          }

          if (alreadyNotified.has(recipientUser.id)) {
            console.log(`[IdeaComments] Mention: userId=${recipientUser.id} already notified — skipping`);
            continue;
          }

          alreadyNotified.add(recipientUser.id);
          console.log(`[IdeaComments] Sending MENTION notification to userId=${recipientUser.id} (${mention.displayName})`);
          await createNotification({
            recipientUserId: recipientUser.id,
            type: "MENTION",
            title: "You were mentioned in a comment",
            message: `${commenterName} mentioned you in a comment: "${mentionDisplay}"`,
            metadata: { ideaId, commentId: comment.id },
          });
        }
      }
    } catch (err) {
      console.error(`[IdeaComments] Mention notification error for commentId=${comment.id}:`, err);
    }

    return NextResponse.json({ comment: { ...comment, authorName: user.name || "Anonymous", userLiked: false, canDelete: true, replies: [] } }, { status: 201 });
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

    const existing = await prisma.ideaCommentLike.findUnique({
      where: { commentId_userId: { commentId, userId: dbUser.id } },
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
        prisma.ideaCommentLike.create({ data: { commentId, userId: dbUser.id } }),
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

    // Allow author or SUPER_ADMIN to delete (userId stores DB User.id)
    const currentDbUser = await prisma.user.findFirst({ where: { logtoId: user.sub }, select: { id: true } });
    const isAuthor = currentDbUser ? comment.userId === currentDbUser.id : false;
    const isSuperAdmin = user.role === "SUPER_ADMIN";

    if (!isAuthor && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await removeCommentHashtags(prisma, id, "IDEA");
    await prisma.ideaComment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
