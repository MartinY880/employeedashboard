// ProConnect — Preferred Vendors API Route
// GET: Fetch all vendors | POST: Create | PUT: Update | DELETE: Remove

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";

    const vendors = await prisma.preferredVendor.findMany({
      where: all ? {} : { active: true },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ vendors });
  } catch (err) {
    console.error("Preferred vendors GET error:", err);
    return NextResponse.json({ vendors: [] });
  }
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_VENDORS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const category = String(body.category ?? "Uncategorized").trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const count = await prisma.preferredVendor.count();

    const vendor = await prisma.preferredVendor.create({
      data: {
        name,
        description: body.description ? String(body.description).trim() : null,
        category,
        contactName: body.contactName ? String(body.contactName).trim() : null,
        contactEmail: body.contactEmail ? String(body.contactEmail).trim() : null,
        contactPhone: body.contactPhone ? String(body.contactPhone).trim() : null,
        contactPhoneLabel: body.contactPhoneLabel ? String(body.contactPhoneLabel).trim() : null,
        secondaryPhone: body.secondaryPhone ? String(body.secondaryPhone).trim() : null,
        secondaryPhoneLabel: body.secondaryPhoneLabel ? String(body.secondaryPhoneLabel).trim() : null,
        website: body.website ? String(body.website).trim() : null,
        logoUrl: body.logoUrl ? String(body.logoUrl).trim() : null,
        iconId: body.iconId ? String(body.iconId).trim() : null,
        address: body.address ? String(body.address).trim() : null,
        labels: body.labels ? String(body.labels).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        sortOrder: count,
        active: body.active !== false,
        featured: body.featured === true,
      },
    });

    return NextResponse.json({ vendor }, { status: 201 });
  } catch (err) {
    console.error("Preferred vendors POST error:", err);
    return NextResponse.json({ error: "Failed to create vendor" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_VENDORS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const id = String(body.id ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const existing = await prisma.preferredVendor.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.description !== undefined) updateData.description = body.description ? String(body.description).trim() : null;
    if (body.category !== undefined) updateData.category = String(body.category).trim();
    if (body.contactName !== undefined) updateData.contactName = body.contactName ? String(body.contactName).trim() : null;
    if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail ? String(body.contactEmail).trim() : null;
    if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone ? String(body.contactPhone).trim() : null;
    if (body.contactPhoneLabel !== undefined) updateData.contactPhoneLabel = body.contactPhoneLabel ? String(body.contactPhoneLabel).trim() : null;
    if (body.secondaryPhone !== undefined) updateData.secondaryPhone = body.secondaryPhone ? String(body.secondaryPhone).trim() : null;
    if (body.secondaryPhoneLabel !== undefined) updateData.secondaryPhoneLabel = body.secondaryPhoneLabel ? String(body.secondaryPhoneLabel).trim() : null;
    if (body.website !== undefined) updateData.website = body.website ? String(body.website).trim() : null;
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl ? String(body.logoUrl).trim() : null;
    if (body.iconId !== undefined) updateData.iconId = body.iconId ? String(body.iconId).trim() : null;
    if (body.address !== undefined) updateData.address = body.address ? String(body.address).trim() : null;
    if (body.labels !== undefined) updateData.labels = body.labels ? String(body.labels).trim() : null;
    if (body.notes !== undefined) updateData.notes = body.notes ? String(body.notes).trim() : null;
    if (body.active !== undefined) updateData.active = Boolean(body.active);
    if (body.featured !== undefined) updateData.featured = Boolean(body.featured);
    if (body.sortOrder !== undefined) updateData.sortOrder = Number(body.sortOrder);

    const vendor = await prisma.preferredVendor.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ vendor });
  } catch (err) {
    console.error("Preferred vendors PUT error:", err);
    return NextResponse.json({ error: "Failed to update vendor" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_VENDORS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.preferredVendor.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Preferred vendors DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete vendor" }, { status: 500 });
  }
}
