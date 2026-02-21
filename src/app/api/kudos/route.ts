// ProConnect — Kudos API Route
// GET: Fetch latest kudos | POST: Create new kudos message

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";

// In-memory store for demo-mode posted kudos (survives refresh, not server restart)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const demoPostedKudos: any[] = [];

// Helper: build photo proxy URL for a user
function authorPhotoUrl(id: string, name: string): string {
  return `/api/directory/photo?userId=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}&size=48x48`;
}

const DEMO_KUDOS = [
  {
    id: "demo-1",
    content: "Amazing job handling the Johnson refinance! The clients were blown away by your attention to detail.",
    authorId: "d1",
    recipientId: "d2",
    author: { id: "d1", displayName: "Maria Garcia", avatarUrl: null, photoUrl: authorPhotoUrl("demo-5", "Maria Garcia") },
    recipient: { id: "d2", displayName: "John Doe", avatarUrl: null, photoUrl: authorPhotoUrl("demo-4", "John Doe") },
    likes: 5,
    badge: "mvp",
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "demo-2",
    content: "Thank you for staying late to help close the deal. True team player! 🌟",
    authorId: "d3",
    recipientId: "d4",
    author: { id: "d3", displayName: "Tom Wilson", avatarUrl: null, photoUrl: authorPhotoUrl("demo-6", "Tom Wilson") },
    recipient: { id: "d4", displayName: "Lisa Park", avatarUrl: null, photoUrl: authorPhotoUrl("demo-3", "Lisa Park") },
    likes: 8,
    badge: "teamplayer",
    createdAt: new Date(Date.now() - 26 * 3600000).toISOString(),
  },
  {
    id: "demo-3",
    content: "Your mentoring of the new hires has been incredible. Keep it up!",
    authorId: "d5",
    recipientId: "d1",
    author: { id: "d5", displayName: "James Chen", avatarUrl: null, photoUrl: authorPhotoUrl("demo-2", "James Chen") },
    recipient: { id: "d1", displayName: "Maria Garcia", avatarUrl: null, photoUrl: authorPhotoUrl("demo-5", "Maria Garcia") },
    likes: 12,
    badge: "heart",
    createdAt: new Date(Date.now() - 50 * 3600000).toISOString(),
  },
  {
    id: "demo-4",
    content: "Kudos for the amazing Q4 presentation. Leadership was very impressed!",
    authorId: "d2",
    recipientId: "d3",
    author: { id: "d2", displayName: "John Doe", avatarUrl: null, photoUrl: authorPhotoUrl("demo-4", "John Doe") },
    recipient: { id: "d3", displayName: "Tom Wilson", avatarUrl: null, photoUrl: authorPhotoUrl("demo-6", "Tom Wilson") },
    likes: 3,
    badge: "rockstar",
    createdAt: new Date(Date.now() - 72 * 3600000).toISOString(),
  },
  {
    id: "demo-5",
    content: "Thanks for jumping on that urgent compliance request. Saved us a huge headache! 🙌",
    authorId: "d4",
    recipientId: "d5",
    author: { id: "d4", displayName: "Lisa Park", avatarUrl: null, photoUrl: authorPhotoUrl("demo-3", "Lisa Park") },
    recipient: { id: "d5", displayName: "James Chen", avatarUrl: null, photoUrl: authorPhotoUrl("demo-2", "James Chen") },
    likes: 6,
    badge: "fire",
    createdAt: new Date(Date.now() - 96 * 3600000).toISOString(),
  },
];

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
    console.error("[Kudos API] GET error (using demo):", error);
    const { searchParams } = new URL(request.url);
    if (searchParams.get("count") === "true") {
      return NextResponse.json({ count: DEMO_KUDOS.length + demoPostedKudos.length, demo: true });
    }
    return NextResponse.json({ kudos: [...demoPostedKudos, ...DEMO_KUDOS], demo: true });
  }
}

export async function POST(request: Request) {
  // Parse body early so it's available in both try and catch
  let body: { content?: string; recipientId?: string; recipientName?: string; badge?: string } = {};
  let authResult: { isAuthenticated: boolean; user: { sub: string; email: string; name: string; role: "ADMIN" | "EMPLOYEE" } | null } = { isAuthenticated: false, user: null };

  try {
    authResult = await getAuthUser();
    if (!authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    body = await request.json();
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
        role: authResult.user.role,
      },
      update: { displayName: authResult.user.name },
    });

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

    return NextResponse.json({ kudos }, { status: 201 });
  } catch (error) {
    console.error("[Kudos API] POST error:", error);

    // Demo fallback — store in memory so it persists across page refreshes
    const mockKudos = {
      id: `demo-${Date.now()}`,
      content: body.content || "",
      authorId: "demo-author",
      recipientId: body.recipientId || "demo-recipient",
      author: {
        id: "demo-author",
        displayName: authResult.user ? authResult.user.name : "You",
        avatarUrl: null,
      },
      recipient: {
        id: body.recipientId || "demo-recipient",
        displayName: body.recipientName || body.recipientId?.split("@")[0] || "Colleague",
        avatarUrl: null,
      },
      likes: 0,
      badge: body.badge || "mvp",
      createdAt: new Date().toISOString(),
    };
    // Persist in memory for GET demo fallback
    demoPostedKudos.unshift(mockKudos);
    return NextResponse.json({ kudos: mockKudos, demo: true }, { status: 201 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Kudos id is required" }, { status: 400 });
    }

    // Handle demo kudos (in-memory) — IDs starting with "demo-"
    if (id.startsWith("demo-")) {
      const postedIdx = demoPostedKudos.findIndex((k) => k.id === id);
      if (postedIdx !== -1) {
        demoPostedKudos.splice(postedIdx, 1);
      }
      const hardcodedIdx = DEMO_KUDOS.findIndex((k) => k.id === id);
      if (hardcodedIdx !== -1) {
        DEMO_KUDOS.splice(hardcodedIdx, 1);
      }
      return NextResponse.json({ success: true, demo: true });
    }

    await prisma.kudosMessage.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Kudos API] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete kudos" }, { status: 500 });
  }
}
