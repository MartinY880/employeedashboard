// ProConnect — Directory Branch Members API
// POST: assign a user to this branch (moves them if already assigned elsewhere)
// DELETE: remove a user from this branch

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { randomUUID } from "crypto";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_DIRECTORY)) return forbidden();

    const { id: branchId } = await params;
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

    // Upsert — moves the user if they were already assigned to another branch
    await prisma.directoryBranchAssignment.upsert({
      where: { userId },
      update: { branchId },
      create: { id: randomUUID(), branchId, userId },
    });

    const branch = await prisma.directoryBranch.findUnique({
      where: { id: branchId },
      include: { assignments: { select: { userId: true } } },
    });

    return NextResponse.json({ branch });
  } catch (error) {
    console.error("[Branch Members] POST error:", error);
    return NextResponse.json({ error: "Failed to assign member" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_DIRECTORY)) return forbidden();

    const { id: branchId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

    await prisma.directoryBranchAssignment.deleteMany({
      where: { branchId, userId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Branch Members] DELETE error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
