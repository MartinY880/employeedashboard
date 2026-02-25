// ProConnect — Kudos API Route
// GET: Fetch latest kudos | POST: Create new kudos message

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS, toDbRole } from "@/lib/rbac";
import { createNotification } from "@/lib/notifications";

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

    return NextResponse.json({ kudos });
  } catch (error) {
    console.error("[Kudos API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch kudos" }, { status: 500 });
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

    if (!content || !recipientId) {
      return NextResponse.json(
        { error: "Content and recipientId are required" },
        { status: 400 }
      );
    }

    // Ensure author exists in DB (upsert for dev mode)
    const dbUser = await prisma.user.upsert({
      where: { logtoId: authResult.user.sub },
      create: {
        logtoId: authResult.user.sub,
        email: authResult.user.email,
        displayName: authResult.user.name,
        role: toDbRole(authResult.user.role),
      },
      update: { displayName: authResult.user.name },
    });

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
