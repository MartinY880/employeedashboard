// ProConnect — Salesforce Report Panels: List Available Logto Roles
// GET → returns all Logto roles for the admin role picker

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listRoles, isM2MConfigured } from "@/lib/logto-management";

export async function GET() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_SALESFORCE_REPORT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isM2MConfigured) {
      return NextResponse.json({ roles: [] });
    }

    const logtoRoles = await listRoles();
    const roles = logtoRoles.map((r) => ({
      id: r.id,
      name: r.name,
      // Normalize for matching (same logic as logto.ts getNormalizedRoles)
      normalized: r.name.trim().toLowerCase().replace(/[\s-]+/g, "_"),
    }));

    return NextResponse.json({ roles });
  } catch (err) {
    console.error("[SF Panels] Roles fetch error:", err);
    return NextResponse.json({ roles: [] });
  }
}
