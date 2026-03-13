// ProConnect — Closers Table Awards API
// GET: list active awards (public) or all awards (admin)
// POST: create a new award (admin)
// PATCH: update an award (admin)
// DELETE: remove an award (admin)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

export async function GET() {
  try {
    const awards = await prisma.closersTableAward.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ awards });
  } catch (err) {
    console.error("[closers-table] GET error:", err);
    return NextResponse.json({ awards: [] });
  }
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_CLOSERS_TABLE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, employeeName, award, color, awardFontSize } = body;

    if (!employeeName || !award) {
      return NextResponse.json({ error: "employeeName and award are required" }, { status: 400 });
    }

    const count = await prisma.closersTableAward.count();
    const created = await prisma.closersTableAward.create({
      data: {
        employeeId: employeeId || null,
        employeeName,
        award,
        color: color || "#f59e0b",
        awardFontSize: awardFontSize || 10,
        sortOrder: count,
      },
    });

    return NextResponse.json({ award: created }, { status: 201 });
  } catch (err) {
    console.error("[closers-table] POST error:", err);
    return NextResponse.json({ error: "Failed to create award" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_CLOSERS_TABLE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, employeeId, employeeName, award, color, awardFontSize, sortOrder, active } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (employeeId !== undefined) data.employeeId = employeeId || null;
    if (employeeName !== undefined) data.employeeName = employeeName;
    if (award !== undefined) data.award = award;
    if (color !== undefined) data.color = color;
    if (awardFontSize !== undefined) data.awardFontSize = awardFontSize;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    if (active !== undefined) data.active = active;

    const updated = await prisma.closersTableAward.update({
      where: { id },
      data,
    });

    return NextResponse.json({ award: updated });
  } catch (err) {
    console.error("[closers-table] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update award" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_CLOSERS_TABLE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.closersTableAward.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[closers-table] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete award" }, { status: 500 });
  }
}
