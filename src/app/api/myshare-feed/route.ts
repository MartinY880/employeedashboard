// ProConnect — MyShare Feed API
// GET: Fetch paginated myshare posts | POST: Create a new post

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { extractMentions, mentionDisplayLength, stripMentionMarkup } from "@/lib/mentions";

export async function GET(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const take = 5;

    // Resolve current user DB id for like status
    const dbUser = await prisma.user.findUnique({
      where: { logtoId: user.sub },
      select: { id: true },
    });
    const currentUserId = dbUser?.id;

    const posts = await prisma.mySharePost.findMany({
      where: { deletedAt: null },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
        media: { orderBy: { sortOrder: "asc" } },
        _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
        likes: currentUserId
          ? { where: { userId: currentUserId }, select: { id: true } }
          : false,
        comments: {
          where: { parentId: null, deletedAt: null },
          orderBy: { createdAt: "asc" },
          take: 5,
          include: {
            author: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
    });

    const hasMore = posts.length > take;
    const items = hasMore ? posts.slice(0, take) : posts;

    const feed = items.map((post) => ({
      id: post.id,
      authorId: post.author.id,
      authorEmail: post.author.email,
      authorName: post.author.displayName,
      caption: post.caption,
      media: post.media.map((m) => ({
        id: m.id,
        fileUrl: m.fileUrl,
        mimeType: m.mimeType,
        sortOrder: m.sortOrder,
      })),
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      userLiked: Array.isArray(post.likes) && post.likes.length > 0,
      previewComments: (post.comments || []).map((c) => ({
        id: c.id,
        authorName: c.author.displayName,
        authorEmail: c.author.email,
        content: c.content,
      })),
      createdAt: post.createdAt.toISOString(),
    }));

    return NextResponse.json({
      posts: feed,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  } catch (err) {
    console.error("[MyShare Feed GET]", err);
    return NextResponse.json({ error: "Failed to load feed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { logtoId: user.sub },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const caption = typeof body.caption === "string" ? body.caption.trim() : null;
    const mediaUrls: { fileUrl: string; mimeType: string; fileSize: number }[] =
      Array.isArray(body.media) ? body.media : [];

    if (!caption && mediaUrls.length === 0) {
      return NextResponse.json(
        { error: "Post must have a caption or at least one image" },
        { status: 400 },
      );
    }

    if (caption && mentionDisplayLength(caption) > 500) {
      return NextResponse.json({ error: "Caption must be 500 characters or less" }, { status: 400 });
    }

    const post = await prisma.mySharePost.create({
      data: {
        authorId: dbUser.id,
        caption: caption || null,
        media: {
          create: mediaUrls.map((m, i) => ({
            fileUrl: m.fileUrl,
            mimeType: m.mimeType || "image/jpeg",
            fileSize: m.fileSize || 0,
            sortOrder: i,
          })),
        },
      },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
        media: { orderBy: { sortOrder: "asc" } },
      },
    });

    try {
      const mentions = extractMentions(caption || "");
      if (mentions.length > 0) {
        const plainCaption = stripMentionMarkup(caption || "");
        const truncatedCaption = plainCaption.length > 120
          ? plainCaption.slice(0, 120) + "…"
          : plainCaption;
        const alreadyNotified = new Set<string>([dbUser.id]);

        for (const mention of mentions) {
          const snapshot = await prisma.$queryRaw<
            { mail: string | null; userPrincipalName: string }[]
          >`
            SELECT mail, user_principal_name AS "userPrincipalName"
            FROM directory_snapshots WHERE id = ${mention.userId} LIMIT 1
          `;

          if (!snapshot[0]) {
            console.log(`[MyShare Feed] Mention: userId=${mention.userId} (${mention.displayName}) not found in directory — skipping`);
            continue;
          }

          const mentionEmail = (snapshot[0].mail || snapshot[0].userPrincipalName).toLowerCase();
          const recipientUser = await prisma.user.findFirst({
            where: { email: { equals: mentionEmail, mode: "insensitive" } },
            select: { id: true },
          });

          if (!recipientUser) {
            console.log(`[MyShare Feed] Mention: no DB user for email=${mentionEmail} — skipping`);
            continue;
          }

          if (alreadyNotified.has(recipientUser.id)) {
            console.log(`[MyShare Feed] Mention: userId=${recipientUser.id} already notified — skipping`);
            continue;
          }

          alreadyNotified.add(recipientUser.id);
          await createNotification({
            recipientUserId: recipientUser.id,
            type: "MENTION",
            title: "You were mentioned in a post",
            message: `${post.author.displayName} mentioned you in a MyShare post: "${truncatedCaption}"`,
            metadata: { postId: post.id },
          });
        }
      }
    } catch (err) {
      console.error(`[MyShare Feed] Mention notification error for postId=${post.id}:`, err);
    }

    return NextResponse.json({
      post: {
        id: post.id,
        authorId: post.author.id,
        authorEmail: post.author.email,
        authorName: post.author.displayName,
        caption: post.caption,
        media: post.media.map((m) => ({
          id: m.id,
          fileUrl: m.fileUrl,
          mimeType: m.mimeType,
          sortOrder: m.sortOrder,
        })),
        likeCount: 0,
        commentCount: 0,
        userLiked: false,
        createdAt: post.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[MyShare Feed POST]", err);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("id");
    if (!postId) {
      return NextResponse.json({ error: "Missing post id" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { logtoId: user.sub },
      select: { id: true },
    });

    const post = await prisma.mySharePost.findUnique({
      where: { id: postId, deletedAt: null },
      select: { authorId: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Only the author or an admin can delete
    const isAuthor = post.authorId === dbUser?.id;
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.mySharePost.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[MyShare Feed DELETE]", err);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
