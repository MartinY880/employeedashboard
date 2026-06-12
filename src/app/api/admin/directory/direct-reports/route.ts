// ProConnect — Root Direct Reports API
// GET: the configured root account's direct reports, unfiltered by job title /
// department (so managing partners with blank Entra titles still appear).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { getRootDirectReports } from "@/lib/directory-snapshot";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_DIRECTORY)) return forbidden();

    const config = await prisma.directoryConfig.findUnique({ where: { id: "singleton" } });
    if (!config?.rootUserId) {
      return NextResponse.json({ users: [] });
    }

    const users = await getRootDirectReports(config.rootUserId);
    return NextResponse.json({ users });
  } catch (error) {
    console.error("[Directory Direct Reports] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch direct reports" }, { status: 500 });
  }
}
