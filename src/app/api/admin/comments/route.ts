// ProConnect — Admin Comments API
// GET: Fetch all comments across widgets | PATCH: Restore soft-deleted comment | DELETE: Soft-delete a comment

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

type WidgetType = "props" | "ideas" | "celebrations" | "video-spotlight" | "myshare";

interface CommentRow {
  id: string;
  widget: WidgetType;
  authorName: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export async function GET(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_COMMENTS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const widget = searchParams.get("widget") as WidgetType | "all" | null;
    const status = searchParams.get("status"); // "active" | "deleted" | null (all)
    const from = searchParams.get("from"); // ISO date string
    const to = searchParams.get("to"); // ISO date string

    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }

    const deletedFilter =
      status === "active" ? { deletedAt: null } :
      status === "deleted" ? { deletedAt: { not: null } } :
      {};

    const createdAtFilter = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};
    const baseWhere = { ...deletedFilter, ...createdAtFilter };

    const comments: CommentRow[] = [];
    const widgets: WidgetType[] =
      widget && widget !== "all"
        ? [widget as WidgetType]
        : ["props", "ideas", "celebrations", "video-spotlight", "myshare"];

    const fetchers: Promise<void>[] = [];

    if (widgets.includes("props")) {
      fetchers.push(
        prisma.propsComment.findMany({
          where: baseWhere,
          orderBy: { createdAt: "desc" },
          include: { author: { select: { displayName: true } } },
        }).then((rows) =>
          rows.forEach((r) =>
            comments.push({
              id: r.id,
              widget: "props",
              authorName: r.author?.displayName ?? "Unknown",
              content: r.content,
              parentId: r.parentId,
              createdAt: r.createdAt.toISOString(),
              deletedAt: r.deletedAt?.toISOString() ?? null,
            })
          )
        )
      );
    }

    if (widgets.includes("ideas")) {
      fetchers.push(
        prisma.ideaComment.findMany({
          where: baseWhere,
          orderBy: { createdAt: "desc" },
          include: { author: { select: { displayName: true } } },
        }).then((rows) =>
          rows.forEach((r) =>
            comments.push({
              id: r.id,
              widget: "ideas",
              authorName: r.author?.displayName ?? "Unknown",
              content: r.content,
              parentId: r.parentId,
              createdAt: r.createdAt.toISOString(),
              deletedAt: r.deletedAt?.toISOString() ?? null,
            })
          )
        )
      );
    }

    if (widgets.includes("celebrations")) {
      fetchers.push(
        prisma.celebrationComment.findMany({
          where: baseWhere,
          orderBy: { createdAt: "desc" },
          include: { author: { select: { displayName: true } } },
        }).then((rows) =>
          rows.forEach((r) =>
            comments.push({
              id: r.id,
              widget: "celebrations",
              authorName: r.author?.displayName ?? "Unknown",
              content: r.content,
              parentId: r.parentId,
              createdAt: r.createdAt.toISOString(),
              deletedAt: r.deletedAt?.toISOString() ?? null,
            })
          )
        )
      );
    }

    if (widgets.includes("video-spotlight")) {
      fetchers.push(
        prisma.videoSpotlightComment.findMany({
          where: baseWhere,
          orderBy: { createdAt: "desc" },
          include: { author: { select: { displayName: true } } },
        }).then((rows) =>
          rows.forEach((r) =>
            comments.push({
              id: r.id,
              widget: "video-spotlight",
              authorName: r.author?.displayName ?? "Unknown",
              content: r.content,
              parentId: r.parentId,
              createdAt: r.createdAt.toISOString(),
              deletedAt: r.deletedAt?.toISOString() ?? null,
            })
          )
        )
      );
    }

    if (widgets.includes("myshare")) {
      fetchers.push(
        prisma.myShareComment.findMany({
          where: baseWhere,
          orderBy: { createdAt: "desc" },
          include: { author: { select: { displayName: true } } },
        }).then((rows) =>
          rows.forEach((r) =>
            comments.push({
              id: r.id,
              widget: "myshare",
              authorName: r.author?.displayName ?? "Unknown",
              content: r.content,
              parentId: r.parentId,
              createdAt: r.createdAt.toISOString(),
              deletedAt: r.deletedAt?.toISOString() ?? null,
            })
          )
        )
      );
    }

    await Promise.all(fetchers);

    // Sort combined results by createdAt descending
    comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ comments });
  } catch (err) {
    console.error("[Admin Comments GET]", err);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

// PATCH — restore a soft-deleted comment
export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_COMMENTS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, widget } = await request.json();
    if (!id || !widget) {
      return NextResponse.json({ error: "Missing id or widget" }, { status: 400 });
    }

    switch (widget as WidgetType) {
      case "props":
        await prisma.propsComment.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "ideas":
        await prisma.ideaComment.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "celebrations":
        await prisma.celebrationComment.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "video-spotlight":
        await prisma.videoSpotlightComment.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "myshare":
        await prisma.myShareComment.update({ where: { id }, data: { deletedAt: null } });
        break;
      default:
        return NextResponse.json({ error: "Invalid widget" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Admin Comments PATCH]", err);
    return NextResponse.json({ error: "Failed to restore comment" }, { status: 500 });
  }
}

// DELETE — soft-delete a comment
export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_COMMENTS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const widget = searchParams.get("widget") as WidgetType | null;

    if (!id || !widget) {
      return NextResponse.json({ error: "Missing id or widget" }, { status: 400 });
    }

    const now = new Date();

    switch (widget) {
      case "props":
        await prisma.propsComment.update({ where: { id }, data: { deletedAt: now } });
        break;
      case "ideas":
        await prisma.ideaComment.update({ where: { id }, data: { deletedAt: now } });
        break;
      case "celebrations":
        await prisma.celebrationComment.update({ where: { id }, data: { deletedAt: now } });
        break;
      case "video-spotlight":
        await prisma.videoSpotlightComment.update({ where: { id }, data: { deletedAt: now } });
        break;
      case "myshare":
        await prisma.myShareComment.update({ where: { id }, data: { deletedAt: now } });
        break;
      default:
        return NextResponse.json({ error: "Invalid widget" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Admin Comments DELETE]", err);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
