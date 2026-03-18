// ProConnect — Admin MyShare Feed API
// GET: Fetch all posts with comments for admin management
// DELETE: Hard delete a post or comment (admin only)
// PATCH: Restore a soft-deleted post or comment (admin only)

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

export async function GET() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_MYSHARE_FEED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const posts = await prisma.mySharePost.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
        media: { orderBy: { sortOrder: "asc" }, select: { id: true, fileUrl: true, mimeType: true } },
        _count: { select: { likes: true, comments: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
    });

    const data = posts.map((post) => ({
      id: post.id,
      authorName: post.author.displayName,
      authorEmail: post.author.email,
      caption: post.caption,
      mediaCount: post.media.length,
      mediaPreview: post.media[0]?.fileUrl ?? null,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      createdAt: post.createdAt.toISOString(),
      deletedAt: post.deletedAt?.toISOString() ?? null,
      comments: post.comments.map((c) => ({
        id: c.id,
        authorName: c.author.displayName,
        authorEmail: c.author.email,
        content: c.content,
        parentId: c.parentId,
        createdAt: c.createdAt.toISOString(),
        deletedAt: c.deletedAt?.toISOString() ?? null,
      })),
    }));

    return NextResponse.json({ posts: data });
  } catch (err) {
    console.error("[Admin MyShare Feed GET]", err);
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_MYSHARE_FEED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");
    const commentId = searchParams.get("commentId");

    if (commentId) {
      await prisma.myShareComment.delete({ where: { id: commentId } });
      return NextResponse.json({ ok: true });
    }

    if (postId) {
      await prisma.mySharePost.delete({ where: { id: postId } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Missing postId or commentId" }, { status: 400 });
  } catch (err) {
    console.error("[Admin MyShare Feed DELETE]", err);
    return NextResponse.json({ error: "Failed to hard delete" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_MYSHARE_FEED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { postId, commentId } = body;

    if (commentId) {
      await prisma.myShareComment.update({
        where: { id: commentId },
        data: { deletedAt: null },
      });
      return NextResponse.json({ ok: true });
    }

    if (postId) {
      await prisma.mySharePost.update({
        where: { id: postId },
        data: { deletedAt: null },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Missing postId or commentId" }, { status: 400 });
  } catch (err) {
    console.error("[Admin MyShare Feed PATCH]", err);
    return NextResponse.json({ error: "Failed to restore" }, { status: 500 });
  }
}
