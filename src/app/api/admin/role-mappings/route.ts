// ProConnect — Role Mappings API Route
// CRUD for job title → Logto role name mappings
// Protected by manage:role_mappings permission

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** GET — List all role mappings */
export async function GET() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) return unauthorized();
    if (!hasPermission(user, PERMISSIONS.MANAGE_ROLE_MAPPINGS)) return forbidden();

    const mappings = await prisma.roleMapping.findMany({
      orderBy: { jobTitle: "asc" },
    });

    return NextResponse.json({ mappings });
  } catch (error) {
    console.error("[Role Mappings API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch role mappings" }, { status: 500 });
  }
}

/** POST — Create a new role mapping */
export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) return unauthorized();
    if (!hasPermission(user, PERMISSIONS.MANAGE_ROLE_MAPPINGS)) return forbidden();

    const body = await request.json();
    const { jobTitle, logtoRoleName } = body;

    if (!jobTitle || !logtoRoleName) {
      return NextResponse.json(
        { error: "jobTitle and logtoRoleName are required" },
        { status: 400 },
      );
    }

    const trimmedTitle = String(jobTitle).trim();
    const trimmedRole = String(logtoRoleName).trim();

    // Check for duplicate (case-insensitive)
    const existing = await prisma.roleMapping.findFirst({
      where: { jobTitle: { equals: trimmedTitle, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `A mapping for "${trimmedTitle}" already exists` },
        { status: 409 },
      );
    }

    const mapping = await prisma.roleMapping.create({
      data: {
        jobTitle: trimmedTitle,
        logtoRoleName: trimmedRole,
      },
    });

    return NextResponse.json({ mapping }, { status: 201 });
  } catch (error) {
    console.error("[Role Mappings API] POST error:", error);
    return NextResponse.json({ error: "Failed to create role mapping" }, { status: 500 });
  }
}

/** PATCH — Update an existing role mapping */
export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) return unauthorized();
    if (!hasPermission(user, PERMISSIONS.MANAGE_ROLE_MAPPINGS)) return forbidden();

    const body = await request.json();
    const { id, jobTitle, logtoRoleName } = body;

    if (!id) {
      return NextResponse.json({ error: "Mapping id is required" }, { status: 400 });
    }

    const updateData: Record<string, string> = {};
    if (jobTitle !== undefined) updateData.jobTitle = String(jobTitle).trim();
    if (logtoRoleName !== undefined) updateData.logtoRoleName = String(logtoRoleName).trim();

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // If changing jobTitle, check uniqueness (case-insensitive)
    if (updateData.jobTitle) {
      const existing = await prisma.roleMapping.findFirst({
        where: {
          jobTitle: { equals: updateData.jobTitle, mode: "insensitive" },
          NOT: { id: String(id) },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: `A mapping for "${updateData.jobTitle}" already exists` },
          { status: 409 },
        );
      }
    }

    const mapping = await prisma.roleMapping.update({
      where: { id: String(id) },
      data: updateData,
    });

    return NextResponse.json({ mapping });
  } catch (error) {
    console.error("[Role Mappings API] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update role mapping" }, { status: 500 });
  }
}

/** DELETE — Remove a role mapping */
export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) return unauthorized();
    if (!hasPermission(user, PERMISSIONS.MANAGE_ROLE_MAPPINGS)) return forbidden();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Mapping id is required" }, { status: 400 });
    }

    await prisma.roleMapping.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Role Mappings API] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete role mapping" }, { status: 500 });
  }
}
