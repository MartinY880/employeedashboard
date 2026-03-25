// ProConnect — Admin Role Sync API
// POST: Sync Logto roles based on directory job titles
// GET:  Preview what would change (dry run)

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasAnyAdminPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  isM2MConfigured,
  syncUserRole,
  mapJobTitleToRoleName,
} from "@/lib/logto-management";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/** GET — Preview: show what role each user would get based on their directory job title */
export async function GET() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasAnyAdminPermission(user)) {
      return forbidden();
    }

    if (!isM2MConfigured) {
      return NextResponse.json(
        { error: "Logto M2M app not configured. Set LOGTO_M2M_APP_ID and LOGTO_M2M_APP_SECRET." },
        { status: 503 },
      );
    }

    // Join directory snapshots with their job titles
    const snapshots = await prisma.directorySnapshot.findMany({
      select: { mail: true, displayName: true, jobTitle: true },
      where: { mail: { not: null } },
      orderBy: { displayName: "asc" },
    });

    const preview = await Promise.all(
      snapshots.map(async (s) => ({
        email: s.mail,
        name: s.displayName,
        jobTitle: s.jobTitle ?? "(none)",
        targetRole: await mapJobTitleToRoleName(s.jobTitle),
      })),
    );

    return NextResponse.json({ count: preview.length, preview });
  } catch (error) {
    console.error("[Sync Roles] GET error:", error);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}

/** POST — Execute: sync roles in Logto for all (or specific) users */
export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasAnyAdminPermission(user)) {
      return forbidden();
    }

    if (!isM2MConfigured) {
      return NextResponse.json(
        { error: "Logto M2M app not configured. Set LOGTO_M2M_APP_ID and LOGTO_M2M_APP_SECRET." },
        { status: 503 },
      );
    }

    // Optional: sync only specific emails
    const body = await request.json().catch(() => ({}));
    const emailFilter: string[] | undefined = body.emails;

    let snapshots;
    if (emailFilter && emailFilter.length > 0) {
      snapshots = await prisma.directorySnapshot.findMany({
        select: { mail: true, jobTitle: true },
        where: { mail: { in: emailFilter, mode: "insensitive" } },
      });
    } else {
      snapshots = await prisma.directorySnapshot.findMany({
        select: { mail: true, jobTitle: true },
        where: { mail: { not: null } },
      });
    }

    const results = [];
    for (const snap of snapshots) {
      if (!snap.mail) continue;
      const result = await syncUserRole(snap.mail, snap.jobTitle);
      results.push(result);
      console.log("[Sync Roles]", result.email, result.status, result.detail ?? "");
    }

    const summary = {
      total: results.length,
      updated: results.filter((r) => r.status === "updated").length,
      unchanged: results.filter((r) => r.status === "unchanged").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
    };

    return NextResponse.json({ summary, results });
  } catch (error) {
    console.error("[Sync Roles] POST error:", error);
    return NextResponse.json({ error: "Failed to sync roles" }, { status: 500 });
  }
}
