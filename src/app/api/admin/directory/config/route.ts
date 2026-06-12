// ProConnect — Directory Config API
// GET/PUT: root account setting (singleton row)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_DIRECTORY)) return forbidden();

    const config = await prisma.directoryConfig.findUnique({ where: { id: "singleton" } });
    return NextResponse.json({ config: config ?? null });
  } catch (error) {
    console.error("[Directory Config] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_DIRECTORY)) return forbidden();

    const body = await request.json();
    const { rootUserId, rootEmail, rootName, sharedEmployeeTypes } = body;

    // Only include fields actually present in the request so a root-account
    // update doesn't clobber sharedEmployeeTypes and vice versa.
    const data: {
      rootUserId?: string | null;
      rootEmail?: string | null;
      rootName?: string | null;
      sharedEmployeeTypes?: string[];
    } = {};
    if ("rootUserId" in body) data.rootUserId = rootUserId ?? null;
    if ("rootEmail" in body) data.rootEmail = rootEmail ?? null;
    if ("rootName" in body) data.rootName = rootName ?? null;
    if ("sharedEmployeeTypes" in body) {
      data.sharedEmployeeTypes = Array.isArray(sharedEmployeeTypes)
        ? sharedEmployeeTypes.filter((t: unknown): t is string => typeof t === "string")
        : [];
    }

    const config = await prisma.directoryConfig.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error("[Directory Config] PUT error:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
