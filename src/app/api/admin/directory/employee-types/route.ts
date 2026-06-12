// ProConnect — Directory Employee Types API
// GET: distinct employeeType values present in the directory snapshot, used to
// populate the admin "Shared Employee Types" picker.

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { getDistinctEmployeeTypes } from "@/lib/directory-snapshot";

export async function GET() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_DIRECTORY)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const employeeTypes = await getDistinctEmployeeTypes();
    return NextResponse.json({ employeeTypes });
  } catch (error) {
    console.error("[Directory Employee Types] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch employee types" }, { status: 500 });
  }
}
