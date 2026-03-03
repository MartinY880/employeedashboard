// ProConnect — Important Dates API
// GET: Fetch dates | POST: Create | PUT: Update | DELETE: Remove

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";

    const dates = await prisma.importantDate.findMany({
      where: all ? undefined : { active: true },
      orderBy: [{ sortOrder: "asc" }, { date: "asc" }],
    });

    return NextResponse.json({ dates });
  } catch (error) {
    console.error("[ImportantDates API] GET error:", error);
    return NextResponse.json({ dates: [] });
  }
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_IMPORTANT_DATES)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { label, date, recurType, sortOrder } = body;

    if (!label?.trim() || !date) {
      return NextResponse.json({ error: "Label and date are required" }, { status: 400 });
    }

    const entry = await prisma.importantDate.create({
      data: {
        label: label.trim(),
        date: new Date(date),
        recurType: recurType ?? "none",
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json({ date: entry }, { status: 201 });
  } catch (error) {
    console.error("[ImportantDates API] POST error:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_IMPORTANT_DATES)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, label, date, recurType, sortOrder, active } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (label !== undefined) data.label = label.trim();
    if (date !== undefined) data.date = new Date(date);
    if (recurType !== undefined) data.recurType = recurType;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    if (active !== undefined) data.active = active;

    const entry = await prisma.importantDate.update({
      where: { id },
      data,
    });

    return NextResponse.json({ date: entry });
  } catch (error) {
    console.error("[ImportantDates API] PUT error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_IMPORTANT_DATES)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.importantDate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ImportantDates API] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
