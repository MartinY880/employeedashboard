// ProConnect — Ideas API Route
// GET: Fetch ideas (with optional filters) | POST: Submit new idea
// PATCH: Vote on idea or update status | DELETE: Remove idea (admin)

import { NextResponse } from "next/server";
import { prisma, ensureDbUser } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createNotification } from "@/lib/notifications";
import { extractMentions, mentionDisplayLength, stripMentionMarkup } from "@/lib/mentions";

export async function GET(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get("count") === "true";
    const status = searchParams.get("status"); // ACTIVE, SELECTED, IN_PROGRESS, COMPLETED, ARCHIVED, or null for all
    const where = status ? { status: status as "ACTIVE" | "SELECTED" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED" } : {};

    if (countOnly) {
      const count = await prisma.idea.count({ where });
      return NextResponse.json({ count });
    }

    const ideas = await prisma.idea.findMany({
      where,
      orderBy: [{ votes: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { comments: true } } },
    });

    // Flatten _count into commentCount
    const ideasWithCounts = ideas.map(({ _count, ...idea }) => ({
      ...idea,
      commentCount: _count.comments,
    }));

    const userVotesByIdea = isAuthenticated && user
      ? Object.fromEntries(
          (await prisma.ideaVote.findMany({
            where: { voterLogtoId: user.sub },
            select: { ideaId: true, direction: true },
          })).map((vote) => [
            vote.ideaId,
            vote.direction === "UP" ? "up" : "down",
          ])
        )
      : {};

    const votedIdeaIds = Object.keys(userVotesByIdea);
    return NextResponse.json({ ideas: ideasWithCounts, votedIdeaIds, userVotesByIdea });
  } catch {
    return NextResponse.json({ error: "Failed to fetch ideas" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    const body = await request.json();
    const { title, description, authorName } = body;

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 });
    }

    if (title.trim().length > 120) {
      return NextResponse.json({ error: "Title must be 120 characters or less" }, { status: 400 });
    }

    if (mentionDisplayLength(description.trim()) > 500) {
      return NextResponse.json({ error: "Description must be 500 characters or less" }, { status: 400 });
    }

    // Resolve DB user ID for authorId (instead of storing logtoId)
    let dbUserId = "anonymous";
    if (isAuthenticated && user) {
      const dbUser = await ensureDbUser(user.sub, user.email, user.name);
      dbUserId = dbUser.id;
    }

    const idea = await prisma.idea.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        authorId: dbUserId,
        authorName: authorName?.trim() || (isAuthenticated && user ? user.name : "Anonymous"),
      },
    });

    const ideaAuthorName = authorName?.trim() || (isAuthenticated && user ? user.name : "Anonymous");

    try {
      const mentions = extractMentions(description.trim());
      const plainDescription = stripMentionMarkup(description.trim());
      const truncatedDescription = plainDescription.length > 120
        ? plainDescription.slice(0, 120) + "…"
        : plainDescription;
      const alreadyNotified = new Set<string>([dbUserId]);

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

        if (!recipientUser || alreadyNotified.has(recipientUser.id)) {
          continue;
        }

        alreadyNotified.add(recipientUser.id);
        await createNotification({
          recipientUserId: recipientUser.id,
          type: "MENTION",
          title: "You were mentioned in an idea",
          message: `${ideaAuthorName} mentioned you in a Be Brilliant idea: "${truncatedDescription}"`,
          metadata: { ideaId: idea.id },
        });
      }
    } catch (err) {
      console.error(`[Ideas] Mention notification error for ideaId=${idea.id}:`, err);
    }

    return NextResponse.json({ idea }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create idea" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    const body = await request.json();
    const { id, vote, status } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    if (vote === "up" || vote === "down") {
      if (!isAuthenticated || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const existingVote = await prisma.ideaVote.findUnique({
        where: {
          ideaId_voterLogtoId: {
            ideaId: id,
            voterLogtoId: user.sub,
          },
        },
      });

      let voteDelta = 0;
      let action: "created" | "switched" | "cleared" = "created";

      if (!existingVote) {
        voteDelta = vote === "up" ? 1 : -1;

        const [, idea] = await prisma.$transaction([
          prisma.ideaVote.create({
            data: {
              ideaId: id,
              voterLogtoId: user.sub,
              direction: vote === "up" ? "UP" : "DOWN",
            },
          }),
          prisma.idea.update({
            where: { id },
            data: { votes: { increment: voteDelta } },
          }),
        ]);

        return NextResponse.json({ idea, action, vote });
      }

      const existingDirection = existingVote.direction === "UP" ? "up" : "down";

      if (existingDirection === vote) {
        action = "cleared";
        voteDelta = vote === "up" ? -1 : 1;

        const [, idea] = await prisma.$transaction([
          prisma.ideaVote.delete({ where: { id: existingVote.id } }),
          prisma.idea.update({
            where: { id },
            data: { votes: { increment: voteDelta } },
          }),
        ]);

        return NextResponse.json({ idea, action, vote: null });
      }

      voteDelta = vote === "up" ? 2 : -2;
      action = "switched";

      const [, idea] = await prisma.$transaction([
        prisma.ideaVote.update({
          where: { id: existingVote.id },
          data: { direction: vote === "up" ? "UP" : "DOWN" },
        }),
        prisma.idea.update({
          where: { id },
          data: { votes: { increment: voteDelta } },
        }),
      ]);

      return NextResponse.json({ idea, action, vote });
    }

    if (status) {
      if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_IDEAS)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const validStatuses = ["ACTIVE", "SELECTED", "IN_PROGRESS", "COMPLETED", "ARCHIVED"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }

      const idea = await prisma.idea.update({
        where: { id },
        data: { status },
      });

      // Send notification + email for stage transitions (not ACTIVE or ARCHIVED)
      const stageNotifications: Record<string, { type: "IDEA_SELECTED" | "IDEA_IN_PROGRESS" | "IDEA_COMPLETED"; title: string; message: (ideaTitle: string) => string }> = {
        SELECTED: {
          type: "IDEA_SELECTED",
          title: "Your idea was selected for development! 💡",
          message: (t) => `Great news! Your Be Brilliant idea "${t}" has been selected for development.`,
        },
        IN_PROGRESS: {
          type: "IDEA_IN_PROGRESS",
          title: "Your idea is now in progress! 🚧",
          message: (t) => `Your Be Brilliant idea "${t}" is now being actively worked on. Stay tuned for updates!`,
        },
        COMPLETED: {
          type: "IDEA_COMPLETED",
          title: "Your idea has been completed! 🎉",
          message: (t) => `Your Be Brilliant idea "${t}" has been fully implemented. Thank you for your brilliant contribution!`,
        },
      };

      // authorId is now a DB User.id — send notification directly
      const notifConfig = stageNotifications[status];
      if (notifConfig && idea.authorId && idea.authorId !== "anonymous") {
        createNotification({
          recipientUserId: idea.authorId,
          type: notifConfig.type,
          title: notifConfig.title,
          message: notifConfig.message(idea.title),
          metadata: { ideaId: idea.id, title: idea.title, status },
        }).catch((err) => console.error("[Ideas] notification error:", err));
      }

      return NextResponse.json({ idea });
    }

    return NextResponse.json({ error: "No valid update provided" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to update idea" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const hardDeleteRequested = searchParams.get("hard") === "true";

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const idea = await prisma.idea.findUnique({
      where: { id },
      select: { authorId: true, status: true },
    });

    if (!idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    const isAdmin = hasPermission(user, PERMISSIONS.MANAGE_IDEAS);
    // authorId is now a DB User.id — look up current user's DB id for comparison
    const currentDbUser = await prisma.user.findFirst({ where: { logtoId: user.sub }, select: { id: true } });
    const isAuthor = currentDbUser ? idea.authorId === currentDbUser.id : false;
    const isLockedStage = idea.status === "IN_PROGRESS" || idea.status === "COMPLETED";

    if (!isAdmin && (!isAuthor || isLockedStage)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Hard delete is opt-in and admin-only.
    if (hardDeleteRequested) {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      await prisma.idea.delete({ where: { id } });
      return NextResponse.json({ success: true, deleted: "hard" });
    }

    // Default behavior: soft-delete into ARCHIVED (visible in admin, hidden from widget).
    await prisma.idea.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
    return NextResponse.json({ success: true, deleted: "soft" });
  } catch {
    return NextResponse.json({ error: "Failed to delete idea" }, { status: 500 });
  }
}
