// ProConnect — Role Mapping Exclusions API Route
// CRUD for users excluded from automatic role mapping
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

/** GET — List all excluded users, optionally search directory users */
export async function GET(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) return unauthorized();
    if (!hasPermission(user, PERMISSIONS.MANAGE_ROLE_MAPPINGS)) return forbidden();

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("search");

    // If ?search= is provided, search directory snapshots for user autocomplete
    if (searchQuery && searchQuery.trim().length >= 2) {
      const users = await prisma.directorySnapshot.findMany({
        where: {
          OR: [
            { displayName: { contains: searchQuery.trim(), mode: "insensitive" } },
            { mail: { contains: searchQuery.trim(), mode: "insensitive" } },
          ],
        },
        select: { displayName: true, mail: true, jobTitle: true },
        orderBy: { displayName: "asc" },
        take: 10,
      });
      return NextResponse.json({ users });
    }

    // Otherwise return all exclusions
    const exclusions = await prisma.roleMappingExclusion.findMany({
      orderBy: { displayName: "asc" },
    });

    return NextResponse.json({ exclusions });
  } catch (error) {
    console.error("[Role Mapping Exclusions API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch exclusions" }, { status: 500 });
  }
}

/** POST — Add a user to the exclusion list */
export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) return unauthorized();
    if (!hasPermission(user, PERMISSIONS.MANAGE_ROLE_MAPPINGS)) return forbidden();

    const body = await request.json();
    const { email, displayName, reason } = body;

    if (!email || !displayName) {
      return NextResponse.json(
        { error: "email and displayName are required" },
        { status: 400 },
      );
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedName = String(displayName).trim();

    // Check for duplicate
    const existing = await prisma.roleMappingExclusion.findFirst({
      where: { email: { equals: trimmedEmail, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `${trimmedName} is already excluded` },
        { status: 409 },
      );
    }

    const exclusion = await prisma.roleMappingExclusion.create({
      data: {
        email: trimmedEmail,
        displayName: trimmedName,
        reason: reason ? String(reason).trim() : null,
      },
    });

    return NextResponse.json({ exclusion }, { status: 201 });
  } catch (error) {
    console.error("[Role Mapping Exclusions API] POST error:", error);
    return NextResponse.json({ error: "Failed to create exclusion" }, { status: 500 });
  }
}

/** DELETE — Remove a user from the exclusion list */
export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) return unauthorized();
    if (!hasPermission(user, PERMISSIONS.MANAGE_ROLE_MAPPINGS)) return forbidden();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Exclusion id is required" }, { status: 400 });
    }

    await prisma.roleMappingExclusion.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Role Mapping Exclusions API] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete exclusion" }, { status: 500 });
  }
}
