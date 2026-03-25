// ProConnect — Per User Reports: Audience Metadata
// GET → Returns role mappings and directory position counts for admin summaries.

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getRoleUserCount, isM2MConfigured, listRoles } from "@/lib/logto-management";

function normalizeRoleToken(role: string): string {
  return role.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export async function GET() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_ACTIVE_PIPELINE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [roleMappings, groupedPositions, logtoRoles] = await Promise.all([
      prisma.roleMapping.findMany({
        orderBy: { jobTitle: "asc" },
        select: {
          id: true,
          jobTitle: true,
          logtoRoleName: true,
        },
      }),
      prisma.directorySnapshot.groupBy({
        by: ["jobTitle"],
        where: {
          jobTitle: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
        orderBy: {
          jobTitle: "asc",
        },
      }),
      isM2MConfigured ? listRoles() : Promise.resolve([]),
    ]);

    const assignedCounts = isM2MConfigured
      ? Object.fromEntries(
          await Promise.all(
            logtoRoles.map(async (role) => [
              normalizeRoleToken(role.name),
              await getRoleUserCount(role.id),
            ] as const),
          ),
        )
      : {};

    const positionCounts = groupedPositions
      .filter((row) => typeof row.jobTitle === "string" && row.jobTitle.trim().length > 0)
      .map((row) => ({
        jobTitle: row.jobTitle as string,
        count: row._count._all,
      }));

    return NextResponse.json({
      roleMappings: roleMappings.map((mapping) => ({
        ...mapping,
        normalizedRole: normalizeRoleToken(mapping.logtoRoleName),
      })),
      positionCounts,
      assignedCounts,
    });
  } catch (err) {
    console.error("[Per User Reports] Audience metadata error:", err);
    return NextResponse.json({ error: "Failed to load audience metadata" }, { status: 500 });
  }
}