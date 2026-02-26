// ProConnect — Kudos API Route
// GET: Fetch latest kudos | POST: Create new kudos message

import { NextResponse } from "next/server";
import type { KudosReactionType } from "@/generated/prisma/client";
import { prisma, ensureDbUser } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS, toDbRole } from "@/lib/rbac";
import { createNotification } from "@/lib/notifications";

const ALLOWED_BADGES = new Set([
  "mvp",
  "rockstar",
  "brainiac",
  "heart",
  "fire",
  "teamplayer",
]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get("count") === "true";
    const monthOnly = searchParams.get("month") === "true";

    if (countOnly) {
      const where = monthOnly
        ? {
            createdAt: {
              gte: new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                1
              ),
            },
          }
        : undefined;
      const count = await prisma.kudosMessage.count({ where });
      return NextResponse.json({ count });
    }

    const kudos = await prisma.kudosMessage.findMany({
      include: {
        author: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        recipient: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const kudosIds = kudos.map((k) => k.id);
    const groupedReactions = kudosIds.length
      ? await prisma.kudosReaction.groupBy({
          by: ["kudosId", "reaction"],
          where: { kudosId: { in: kudosIds } },
          _count: { _all: true },
        })
      : [];

    const authResult = await getAuthUser();
    let currentUserId: string | null = null;
    if (authResult.isAuthenticated && authResult.user) {
      const dbUser = await prisma.user.findUnique({ where: { logtoId: authResult.user.sub } });
      currentUserId = dbUser?.id || null;
    }

    const myReactionsRaw = currentUserId && kudosIds.length
      ? await prisma.kudosReaction.findMany({
          where: { userId: currentUserId, kudosId: { in: kudosIds } },
          select: { kudosId: true, reaction: true },
          orderBy: { createdAt: "desc" },
        })
      : [];

    const reactionCountsMap = new Map<string, { highfive: number; uplift: number; bomb: number }>();
    for (const reaction of groupedReactions) {
      const existing = reactionCountsMap.get(reaction.kudosId) || { highfive: 0, uplift: 0, bomb: 0 };
      if (reaction.reaction === "HIGHFIVE") existing.highfive = reaction._count._all;
      if (reaction.reaction === "UPLIFT") existing.uplift = reaction._count._all;
      if (reaction.reaction === "BOMB") existing.bomb = reaction._count._all;
      reactionCountsMap.set(reaction.kudosId, existing);
    }

    const myReactionsMap = new Map<string, Array<"highfive" | "uplift" | "bomb">>();
    for (const reaction of myReactionsRaw) {
      if (myReactionsMap.has(reaction.kudosId)) continue;
      if (reaction.reaction === "HIGHFIVE") myReactionsMap.set(reaction.kudosId, ["highfive"]);
      if (reaction.reaction === "UPLIFT") myReactionsMap.set(reaction.kudosId, ["uplift"]);
      if (reaction.reaction === "BOMB") myReactionsMap.set(reaction.kudosId, ["bomb"]);
    }

    const hydratedKudos = kudos.map((k) => ({
      ...k,
      reactions: reactionCountsMap.get(k.id) || { highfive: 0, uplift: 0, bomb: 0 },
      myReactions: myReactionsMap.get(k.id) || [],
    }));

    return NextResponse.json({ kudos: hydratedKudos, currentUserId });
  } catch (error) {
    console.error("[Kudos API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch kudos" }, { status: 500 });
  }
}

const REACTION_KEY_TO_ENUM: Record<string, KudosReactionType> = {
  highfive: "HIGHFIVE",
  uplift: "UPLIFT",
  bomb: "BOMB",
};

const ENUM_TO_REACTION_KEY: Record<KudosReactionType, "highfive" | "uplift" | "bomb"> = {
  HIGHFIVE: "highfive",
  UPLIFT: "uplift",
  BOMB: "bomb",
};

export async function PATCH(request: Request) {
  try {
    const authResult = await getAuthUser();
    if (!authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { kudosId?: string; reaction?: "highfive" | "uplift" | "bomb" } = await request.json();
    const { kudosId, reaction } = body;

    if (!kudosId || !reaction || !REACTION_KEY_TO_ENUM[reaction]) {
      return NextResponse.json({ error: "kudosId and valid reaction are required" }, { status: 400 });
    }

    const dbUser = await ensureDbUser(
      authResult.user.sub,
      authResult.user.email,
      authResult.user.name,
      toDbRole(authResult.user.role),
    );

    const reactionEnum = REACTION_KEY_TO_ENUM[reaction];

    const existingReactions = await prisma.kudosReaction.findMany({
      where: {
        kudosId,
        userId: dbUser.id,
      },
      select: {
        id: true,
        reaction: true,
      },
    });

    const hasOnlySameReaction =
      existingReactions.length === 1 &&
      existingReactions[0].reaction === reactionEnum;

    if (hasOnlySameReaction) {
      await prisma.kudosReaction.delete({ where: { id: existingReactions[0].id } });
    } else {
      await prisma.$transaction([
        prisma.kudosReaction.deleteMany({
          where: {
            kudosId,
            userId: dbUser.id,
          },
        }),
        prisma.kudosReaction.create({
          data: {
            kudosId,
            userId: dbUser.id,
            reaction: reactionEnum,
          },
        }),
      ]);
    }

    const groupedReactions = await prisma.kudosReaction.groupBy({
      by: ["reaction"],
      where: { kudosId },
      _count: { _all: true },
    });

    const myReactionsRaw = await prisma.kudosReaction.findMany({
      where: { kudosId, userId: dbUser.id },
      select: { reaction: true },
    });

    const reactions = { highfive: 0, uplift: 0, bomb: 0 };
    for (const item of groupedReactions) {
      if (item.reaction === "HIGHFIVE") reactions.highfive = item._count._all;
      if (item.reaction === "UPLIFT") reactions.uplift = item._count._all;
      if (item.reaction === "BOMB") reactions.bomb = item._count._all;
    }

    const myReactions = myReactionsRaw.map((item) => ENUM_TO_REACTION_KEY[item.reaction]);

    return NextResponse.json({ kudosId, reactions, myReactions });
  } catch (error) {
    console.error("[Kudos API] PATCH reaction error:", error);
    return NextResponse.json({ error: "Failed to toggle reaction" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await getAuthUser();
    if (!authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { content?: string; recipientId?: string; recipientName?: string; badge?: string } = await request.json();
    const { content, recipientId } = body;
    const badge = typeof body.badge === "string" && ALLOWED_BADGES.has(body.badge)
      ? body.badge
      : "mvp";

    if (!content || !recipientId) {
      return NextResponse.json(
        { error: "Content and recipientId are required" },
        { status: 400 }
      );
    }

    // Ensure author exists in DB (handles directory-stub merging)
    const dbUser = await ensureDbUser(
      authResult.user.sub,
      authResult.user.email,
      authResult.user.name,
      toDbRole(authResult.user.role),
    );

    // Prevent self-props
    if (
      recipientId === authResult.user.email ||
      recipientId === authResult.user.sub ||
      recipientId === dbUser.id
    ) {
      return NextResponse.json(
        { error: "You cannot give props to yourself" },
        { status: 400 }
      );
    }

    // recipientId may be an email address (from PeoplePicker).
    // Resolve it to a User record — upsert if it looks like an email.
    let resolvedRecipientId = recipientId;

    if (recipientId.includes("@")) {
      const recipientUser = await prisma.user.upsert({
        where: { email: recipientId },
        create: {
          logtoId: `directory-${recipientId}`,
          email: recipientId,
          displayName: body.recipientName || recipientId.split("@")[0],
          role: "EMPLOYEE",
        },
        update: {},
      });
      resolvedRecipientId = recipientUser.id;
    }

    const kudos = await prisma.kudosMessage.create({
      data: {
        content,
        badge,
        authorId: dbUser.id,
        recipientId: resolvedRecipientId,
      },
      include: {
        author: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        recipient: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    // Send notification to the recipient
    createNotification({
      recipientUserId: resolvedRecipientId,
      type: "KUDOS",
      title: "You received props! \uD83C\uDF89",
      message: `${authResult.user.name} gave you props: "${content.slice(0, 120)}${content.length > 120 ? "..." : ""}"`,
      metadata: { senderName: authResult.user.name, kudosId: kudos.id },
    }).catch((err) => console.error("[Kudos] notification error:", err));

    return NextResponse.json({ kudos }, { status: 201 });
  } catch (error) {
    console.error("[Kudos API] POST error:", error);
    return NextResponse.json({ error: "Failed to create props" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_KUDOS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Kudos id is required" }, { status: 400 });
    }

    await prisma.kudosMessage.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Kudos API] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete kudos" }, { status: 500 });
  }
}
