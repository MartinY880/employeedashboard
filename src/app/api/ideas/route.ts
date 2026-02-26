// ProConnect — Ideas API Route
// GET: Fetch ideas (with optional filters) | POST: Submit new idea
// PATCH: Vote on idea or update status | DELETE: Remove idea (admin)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get("count") === "true";
    const status = searchParams.get("status"); // ACTIVE, SELECTED, ARCHIVED, or null for all
    const where = status ? { status: status as "ACTIVE" | "SELECTED" | "ARCHIVED" } : {};

    if (countOnly) {
      const count = await prisma.idea.count({ where });
      return NextResponse.json({ count });
    }

    const ideas = await prisma.idea.findMany({
      where,
      orderBy: [{ votes: "desc" }, { createdAt: "desc" }],
    });

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
    return NextResponse.json({ ideas, votedIdeaIds, userVotesByIdea });
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

    const idea = await prisma.idea.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        authorId: isAuthenticated && user ? user.sub : "anonymous",
        authorName: authorName?.trim() || (isAuthenticated && user ? user.name : "Anonymous"),
      },
    });
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

      const idea = await prisma.idea.update({
        where: { id },
        data: { status },
      });

      if (status === "SELECTED" && idea.authorId && idea.authorId !== "anonymous") {
        const author = await prisma.user.findFirst({
          where: {
            OR: [
              { logtoId: idea.authorId },
              { email: idea.authorId },
            ],
          },
        });
        if (author) {
          createNotification({
            recipientUserId: author.id,
            type: "IDEA_SELECTED",
            title: "Your idea was selected! \uD83D\uDCA1",
            message: `Your Be Brilliant idea "${idea.title}" has been selected!`,
            metadata: { ideaId: idea.id, title: idea.title },
          }).catch((err) => console.error("[Ideas] notification error:", err));
        }
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
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_IDEAS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.idea.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete idea" }, { status: 500 });
  }
}
