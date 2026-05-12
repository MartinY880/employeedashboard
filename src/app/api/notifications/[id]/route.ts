// ProConnect — Notification Detail API
// GET: Fetch a single notification with its source item data for the detail view

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { isAuthenticated, user } = await getAuthUser();
  if (!isAuthenticated || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const dbUser = await prisma.user.findUnique({
    where: { logtoId: user.sub },
    select: { id: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== dbUser.id) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  // Mark as read
  if (!notification.read) {
    await prisma.notification.update({ where: { id }, data: { read: true } });
  }

  let metadata: Record<string, string> = {};
  try {
    metadata = notification.metadata ? JSON.parse(notification.metadata as string) : {};
  } catch { /* ignore */ }

  const sourceType = metadata.sourceType;
  const sourceId = metadata.sourceId;

  if (!sourceType || !sourceId) {
    return NextResponse.json({ notification, source: null });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let source: any = null;

  switch (sourceType) {
    case "props": {
      const props = await prisma.propsMessage.findUnique({
        where: { id: sourceId },
        include: {
          author: { select: { id: true, displayName: true, email: true } },
          recipient: { select: { id: true, displayName: true, email: true } },
        },
      });
      if (props) {
        source = {
          type: "props",
          id: props.id,
          authorName: props.author?.displayName ?? "Unknown",
          authorId: props.author?.id,
          recipientName: props.recipient?.displayName ?? "Unknown",
          recipientId: props.recipient?.id,
          content: props.content,
          badge: props.badge,
          createdAt: props.createdAt.toISOString(),
        };
      }
      break;
    }
    case "idea": {
      const idea = await prisma.idea.findUnique({
        where: { id: sourceId },
        include: {
          author: { select: { id: true, displayName: true } },
        },
      });
      if (idea) {
        source = {
          type: "idea",
          id: idea.id,
          title: idea.title,
          description: idea.description,
          authorName: idea.author?.displayName ?? "Anonymous",
          status: idea.status,
          votes: idea.votes,
          createdAt: idea.createdAt.toISOString(),
        };
      }
      break;
    }
    case "highlight": {
      const highlight = await prisma.employeeHighlight.findUnique({
        where: { id: sourceId },
      });
      if (highlight) {
        source = {
          type: "highlight",
          id: highlight.id,
          employeeName: highlight.employeeName,
          title: highlight.title,
          subtitle: highlight.subtitle,
          createdAt: highlight.createdAt.toISOString(),
        };
      }
      break;
    }
    case "myshare": {
      const post = await prisma.mySharePost.findUnique({
        where: { id: sourceId },
        include: {
          author: { select: { id: true, displayName: true, email: true } },
          media: { orderBy: { sortOrder: "asc" }, select: { id: true, fileUrl: true, mimeType: true } },
        },
      });
      if (post) {
        source = {
          type: "myshare",
          id: post.id,
          authorName: post.author?.displayName ?? "Unknown",
          authorId: post.author?.id,
          caption: post.caption,
          media: post.media,
          createdAt: post.createdAt.toISOString(),
        };
      }
      break;
    }
    case "celebration": {
      const celebration = await prisma.celebrationEvent.findUnique({
        where: { id: sourceId },
      });
      if (celebration) {
        source = {
          type: "celebration",
          id: celebration.id,
          employeeName: celebration.employeeName,
          celebrationType: celebration.type,
          detail: celebration.detail,
          eventDate: celebration.eventDate.toISOString(),
          createdAt: celebration.createdAt.toISOString(),
        };
      }
      break;
    }
    case "video-spotlight": {
      const video = await prisma.videoSpotlight.findUnique({
        where: { id: sourceId },
        include: {
          author: { select: { id: true, displayName: true } },
        },
      });
      if (video) {
        source = {
          type: "video-spotlight",
          id: video.id,
          title: video.title,
          authorName: video.author?.displayName ?? "Unknown",
          createdAt: video.createdAt.toISOString(),
        };
      }
      break;
    }
  }

  return NextResponse.json({ notification, source });
}
