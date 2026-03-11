// ProConnect — Lender Account Executives API Route
// GET: Fetch active/all records | POST: Create | PUT: Update | DELETE: Remove

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";
    const countOnly = searchParams.get("count") === "true";

    const where = all ? {} : { active: true, lender: { active: true } };

    if (countOnly) {
      const count = await prisma.lenderAccountExecutive.count({ where });
      return NextResponse.json({ count });
    }

    const records = await prisma.lenderAccountExecutive.findMany({
      where,
      include: {
        lender: { select: { id: true, name: true, logoUrl: true, active: true } },
      },
      orderBy: [{ lender: { name: "asc" } }, { sortOrder: "asc" }, { accountExecutiveName: "asc" }],
    });

    return NextResponse.json({ records });
  } catch (err) {
    console.error("Lender account executives GET error:", err);
    return NextResponse.json({ records: [] });
  }
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_LENDER_ACCOUNT_EXECUTIVES)) {
      return NextResponse.json({ error: "Forbidden: missing permission manage:lender_account_executives" }, { status: 403 });
    }

    const body = await request.json();
    const lenderId = String(body.lenderId ?? "").trim();
    const accountExecutiveName = String(body.accountExecutiveName ?? "").trim();
    const workPhoneNumber = String(body.workPhoneNumber ?? "").trim();
    const phoneExtension = String(body.phoneExtension ?? "").trim() || null;
    const mobilePhoneNumber = String(body.mobilePhoneNumber ?? "").trim() || null;
    const email = String(body.email ?? "").trim();

    if (!lenderId || !accountExecutiveName) {
      return NextResponse.json({ error: "Lender and name are required" }, { status: 400 });
    }

    const lender = await prisma.lender.findUnique({ where: { id: lenderId } });
    if (!lender) {
      return NextResponse.json({ error: "Lender not found" }, { status: 404 });
    }

    const sortOrder = await prisma.lenderAccountExecutive.count({
      where: { lenderId },
    });

    const record = await prisma.lenderAccountExecutive.create({
      data: {
        lenderId,
        accountExecutiveName,
        workPhoneNumber,
        phoneExtension,
        mobilePhoneNumber,
        email,
        active: body.active !== false,
        sortOrder,
      },
      include: {
        lender: { select: { id: true, name: true, logoUrl: true, active: true } },
      },
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    console.error("Lender account executives POST error:", err);
    return NextResponse.json({ error: "Failed to create record" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_LENDER_ACCOUNT_EXECUTIVES)) {
      return NextResponse.json({ error: "Forbidden: missing permission manage:lender_account_executives" }, { status: 403 });
    }

    const body = await request.json();
    const id = String(body.id ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const existing = await prisma.lenderAccountExecutive.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const updateData: {
      lenderId?: string;
      accountExecutiveName?: string;
      workPhoneNumber?: string;
      phoneExtension?: string | null;
      mobilePhoneNumber?: string | null;
      email?: string;
      active?: boolean;
      sortOrder?: number;
    } = {};

    if (body.lenderId !== undefined) {
      const lender = await prisma.lender.findUnique({ where: { id: String(body.lenderId) } });
      if (!lender) {
        return NextResponse.json({ error: "Lender not found" }, { status: 404 });
      }
      updateData.lenderId = String(body.lenderId);
    }
    if (body.accountExecutiveName !== undefined) updateData.accountExecutiveName = String(body.accountExecutiveName).trim();
    if (body.workPhoneNumber !== undefined) updateData.workPhoneNumber = String(body.workPhoneNumber).trim();
    if (body.phoneExtension !== undefined) updateData.phoneExtension = String(body.phoneExtension).trim() || null;
    if (body.mobilePhoneNumber !== undefined) updateData.mobilePhoneNumber = String(body.mobilePhoneNumber).trim() || null;
    if (body.email !== undefined) updateData.email = String(body.email).trim();
    if (body.active !== undefined) updateData.active = Boolean(body.active);
    if (body.sortOrder !== undefined) updateData.sortOrder = Number(body.sortOrder);

    const record = await prisma.lenderAccountExecutive.update({
      where: { id },
      data: updateData,
      include: {
        lender: { select: { id: true, name: true, logoUrl: true, active: true } },
      },
    });

    return NextResponse.json({ record });
  } catch (err) {
    console.error("Lender account executives PUT error:", err);
    return NextResponse.json({ error: "Failed to update record" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_LENDER_ACCOUNT_EXECUTIVES)) {
      return NextResponse.json({ error: "Forbidden: missing permission manage:lender_account_executives" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.lenderAccountExecutive.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Lender account executives DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete record" }, { status: 500 });
  }
}
