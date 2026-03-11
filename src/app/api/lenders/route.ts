// ProConnect — Lenders API Route
// GET: List lenders | POST: Create | PUT: Update | DELETE: Remove

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";

    const where = all ? {} : { active: true };

    const lenders = await prisma.lender.findMany({
      where,
      include: {
        _count: { select: { accountExecutives: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ lenders });
  } catch (err) {
    console.error("Lenders GET error:", err);
    return NextResponse.json({ lenders: [] });
  }
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_LENDER_ACCOUNT_EXECUTIVES)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const name = String(body.name ?? "").trim();

    if (!name) {
      return NextResponse.json({ error: "Lender name is required" }, { status: 400 });
    }

    const existing = await prisma.lender.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: "A lender with that name already exists" }, { status: 409 });
    }

    const sortOrder = await prisma.lender.count();

    const lender = await prisma.lender.create({
      data: {
        name,
        logoUrl: body.logoUrl || null,
        active: body.active !== false,
        sortOrder,
      },
    });

    return NextResponse.json({ lender }, { status: 201 });
  } catch (err) {
    console.error("Lenders POST error:", err);
    return NextResponse.json({ error: "Failed to create lender" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_LENDER_ACCOUNT_EXECUTIVES)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const id = String(body.id ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const existing = await prisma.lender.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Lender not found" }, { status: 404 });
    }

    const updateData: {
      name?: string;
      logoUrl?: string | null;
      active?: boolean;
      sortOrder?: number;
    } = {};

    if (body.name !== undefined) {
      const newName = String(body.name).trim();
      if (!newName) {
        return NextResponse.json({ error: "Lender name cannot be empty" }, { status: 400 });
      }
      // Check uniqueness if name is changing
      if (newName !== existing.name) {
        const conflict = await prisma.lender.findUnique({ where: { name: newName } });
        if (conflict) {
          return NextResponse.json({ error: "A lender with that name already exists" }, { status: 409 });
        }
      }
      updateData.name = newName;
    }

    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl || null;
    if (body.active !== undefined) updateData.active = Boolean(body.active);
    if (body.sortOrder !== undefined) updateData.sortOrder = Number(body.sortOrder);

    const lender = await prisma.lender.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ lender });
  } catch (err) {
    console.error("Lenders PUT error:", err);
    return NextResponse.json({ error: "Failed to update lender" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_LENDER_ACCOUNT_EXECUTIVES)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Cascade delete will remove associated AEs
    await prisma.lender.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Lenders DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete lender" }, { status: 500 });
  }
}
