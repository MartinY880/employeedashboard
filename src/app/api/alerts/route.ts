// ProConnect — Alerts API Route
// GET: Fetch active alerts | POST: Create alert (admin)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";

// In-memory store for demo-mode posted alerts (survives refresh, not server restart)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const demoPostedAlerts: any[] = [];

const DEMO_ALERTS = [
  {
    id: "demo-a1",
    title: "System Maintenance",
    content: "Portal will be briefly unavailable Saturday 2 AM–4 AM EST for scheduled upgrades.",
    type: "WARNING" as const,
    priority: "HIGH" as const,
    active: true,
    createdBy: "d1",
    author: { id: "d1", displayName: "IT Admin" },
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: "demo-a2",
    title: "Happy Birthday, Maria! 🎂",
    content: "Join us in wishing Maria Garcia a wonderful birthday! Cake in the break room at 3 PM.",
    type: "BIRTHDAY" as const,
    priority: "LOW" as const,
    active: true,
    createdBy: "d2",
    author: { id: "d2", displayName: "HR Team" },
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  {
    id: "demo-a3",
    title: "Welcome New Team Member",
    content: "Please welcome Alex Rivera to the Processing team starting next Monday!",
    type: "NEW_HIRE" as const,
    priority: "MEDIUM" as const,
    active: true,
    createdBy: "d2",
    author: { id: "d2", displayName: "HR Team" },
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
  {
    id: "demo-a4",
    title: "Q1 Town Hall Reminder",
    content: "Don't forget — company-wide Town Hall this Friday at 11 AM. Attendance is mandatory.",
    type: "ANNOUNCEMENT" as const,
    priority: "MEDIUM" as const,
    active: true,
    createdBy: "d3",
    author: { id: "d3", displayName: "Executive Office" },
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
  },
  {
    id: "demo-a5",
    title: "New Compliance Training Available",
    content: "Annual compliance training module is now available in the Learning Portal. Due by March 15.",
    type: "INFO" as const,
    priority: "LOW" as const,
    active: true,
    createdBy: "d1",
    author: { id: "d1", displayName: "Compliance Dept" },
    createdAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 72 * 3600000).toISOString(),
  },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") !== "false";
    const countOnly = searchParams.get("count") === "true";

    if (countOnly) {
      const count = await prisma.alert.count({
        where: activeOnly ? { active: true } : undefined,
      });
      if (count === 0) {
        const allDemo = [...demoPostedAlerts, ...DEMO_ALERTS];
        const filtered = activeOnly ? allDemo.filter((a) => a.active) : allDemo;
        return NextResponse.json({ count: filtered.length, demo: true });
      }
      return NextResponse.json({ count });
    }

    const alerts = await prisma.alert.findMany({
      where: activeOnly ? { active: true } : undefined,
      include: {
        author: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
      take: 50,
    });

    // If DB is empty, show demo data
    if (alerts.length === 0) {
      const allDemo = [...demoPostedAlerts, ...DEMO_ALERTS];
      const filtered = activeOnly ? allDemo.filter((a) => a.active) : allDemo;
      return NextResponse.json({ alerts: filtered, demo: true });
    }

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("[Alerts API] GET error (using demo):", error);
    const { searchParams } = new URL(request.url);
    if (searchParams.get("count") === "true") {
      const allDemo = [...demoPostedAlerts, ...DEMO_ALERTS];
      const activeOnly = searchParams.get("active") !== "false";
      const filtered = activeOnly ? allDemo.filter((a) => a.active) : allDemo;
      return NextResponse.json({ count: filtered.length, demo: true });
    }
    const allDemo = [...demoPostedAlerts, ...DEMO_ALERTS];
    const activeOnly = searchParams.get("active") !== "false";
    const filtered = activeOnly ? allDemo.filter((a) => a.active) : allDemo;
    return NextResponse.json({ alerts: filtered, demo: true });
  }
}

export async function POST(request: Request) {
  // Parse body and auth early so they're available in catch
  let body: { title?: string; content?: string; type?: string; priority?: string } = {};
  let authResult: { isAuthenticated: boolean; user: { sub: string; email: string; name: string; role: "ADMIN" | "EMPLOYEE" } | null } = { isAuthenticated: false, user: null };

  try {
    authResult = await getAuthUser();
    if (!authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (authResult.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    body = await request.json();
    const { title, content } = body;
    const type = body.type as "INFO" | "WARNING" | "BIRTHDAY" | "NEW_HIRE" | "ANNOUNCEMENT" | undefined;
    const priority = body.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const user = authResult.user;
    // Ensure user exists in DB (upsert for dev mode)
    const dbUser = await prisma.user.upsert({
      where: { logtoId: user.sub },
      create: {
        logtoId: user.sub,
        email: user.email,
        displayName: user.name,
        role: user.role,
      },
      update: { displayName: user.name },
    });

    const alert = await prisma.alert.create({
      data: {
        title,
        content,
        type: type || "INFO",
        priority: priority || "LOW",
        createdBy: dbUser.id,
      },
      include: {
        author: {
          select: { id: true, displayName: true },
        },
      },
    });

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    console.error("[Alerts API] POST error (using demo):", error);

    // Demo fallback — store in memory
    const mockAlert = {
      id: `demo-a${Date.now()}`,
      title: body.title || "Untitled",
      content: body.content || "",
      type: body.type || "INFO",
      priority: body.priority || "LOW",
      active: true,
      createdBy: "demo-admin",
      author: { id: "demo-admin", displayName: authResult.user ? authResult.user.name : "Admin" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    demoPostedAlerts.unshift(mockAlert);
    return NextResponse.json({ alert: mockAlert, demo: true }, { status: 201 });
  }
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown> = {};

  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "Alert id is required" }, { status: 400 });
    }

    // Only allow updating specific fields
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.active !== undefined) updateData.active = data.active;

    const alert = await prisma.alert.update({
      where: { id: id as string },
      data: updateData,
      include: {
        author: { select: { id: true, displayName: true } },
      },
    });

    return NextResponse.json({ alert });
  } catch (error) {
    console.error("[Alerts API] PATCH error (using demo):", error);

    // Demo fallback — update in-memory
    const id = body.id as string;
    if (id) {
      const inPosted = demoPostedAlerts.find((a) => a.id === id);
      const inHardcoded = DEMO_ALERTS.find((a) => a.id === id);
      const target = inPosted || inHardcoded;
      if (target) {
        if (body.title !== undefined) target.title = body.title;
        if (body.content !== undefined) target.content = body.content;
        if (body.type !== undefined) target.type = body.type;
        if (body.priority !== undefined) target.priority = body.priority;
        if (body.active !== undefined) target.active = body.active;
        target.updatedAt = new Date().toISOString();
        return NextResponse.json({ alert: target, demo: true });
      }
    }
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
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
      return NextResponse.json({ error: "Alert id is required" }, { status: 400 });
    }

    // Handle demo alerts (in-memory)
    if (id.startsWith("demo-")) {
      const postedIdx = demoPostedAlerts.findIndex((a) => a.id === id);
      if (postedIdx !== -1) demoPostedAlerts.splice(postedIdx, 1);
      const hardIdx = DEMO_ALERTS.findIndex((a) => a.id === id);
      if (hardIdx !== -1) DEMO_ALERTS.splice(hardIdx, 1);
      return NextResponse.json({ success: true, demo: true });
    }

    await prisma.alert.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Alerts API] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }
}
