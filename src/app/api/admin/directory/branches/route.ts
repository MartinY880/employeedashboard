// ProConnect — Directory Branches API
// GET: list all branches with their assigned members
// POST: create a new branch
// PUT: update name / reorder (pass array of {id, sortOrder})

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { randomUUID } from "crypto";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_DIRECTORY)) return forbidden();

    const branches = await prisma.directoryBranch.findMany({
      orderBy: { sortOrder: "asc" },
      include: { assignments: { select: { userId: true } } },
    });

    return NextResponse.json({ branches });
  } catch (error) {
    console.error("[Directory Branches] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_DIRECTORY)) return forbidden();

    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const last = await prisma.directoryBranch.findFirst({ orderBy: { sortOrder: "desc" } });
    const branch = await prisma.directoryBranch.create({
      data: { id: randomUUID(), name: name.trim(), sortOrder: (last?.sortOrder ?? -1) + 1 },
      include: { assignments: { select: { userId: true } } },
    });

    return NextResponse.json({ branch }, { status: 201 });
  } catch (error) {
    console.error("[Directory Branches] POST error:", error);
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
  }
}

// PUT: batch reorder [{id, sortOrder}] OR rename a single branch {id, name}
export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_DIRECTORY)) return forbidden();

    const body = await request.json();

    // Batch reorder
    if (Array.isArray(body)) {
      await Promise.all(
        body.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
          prisma.directoryBranch.update({ where: { id }, data: { sortOrder } })
        )
      );
      return NextResponse.json({ ok: true });
    }

    // Single update (rename)
    const { id, name } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const branch = await prisma.directoryBranch.update({
      where: { id },
      data: { ...(name !== undefined && { name: name.trim() }) },
      include: { assignments: { select: { userId: true } } },
    });

    return NextResponse.json({ branch });
  } catch (error) {
    console.error("[Directory Branches] PUT error:", error);
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_DIRECTORY)) return forbidden();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await prisma.directoryBranch.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Directory Branches] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 });
  }
}
