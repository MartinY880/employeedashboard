// ProConnect — Salesforce Report Panels: Force Refresh
// POST → Admin force-refreshes a specific panel's cached data

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { executeReport } from "@/lib/salesforce-client";
import type { SfReportPanelsConfig } from "@/types/salesforce-panels";

const PANELS_ID = "sf_report_panels";
const CACHE_PREFIX = "sf_panel_cache_";

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_SALESFORCE_REPORT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const panelId = String(body.panelId || "");

    if (!panelId) {
      return NextResponse.json({ error: "panelId is required" }, { status: 400 });
    }

    // Load panels config to get the report ID
    const row = await prisma.calendarSetting.findUnique({ where: { id: PANELS_ID } });
    if (!row?.data) {
      return NextResponse.json({ error: "No panels configured" }, { status: 400 });
    }

    const config: SfReportPanelsConfig = JSON.parse(row.data);
    const panel = config.panels.find((p) => p.id === panelId);

    if (!panel) {
      return NextResponse.json({ error: "Panel not found" }, { status: 404 });
    }

    if (!panel.reportId) {
      return NextResponse.json({ error: "Panel has no report configured" }, { status: 400 });
    }

    const result = await executeReport(panel.reportId);

    const cacheData = {
      fetchedAt: new Date().toISOString(),
      reportName: result.reportName,
      columns: result.columns.map((c) => ({ name: c.name, label: c.label })),
      rows: result.rows,
    };

    const cacheId = CACHE_PREFIX + panelId;
    await prisma.calendarSetting.upsert({
      where: { id: cacheId },
      create: { id: cacheId, data: JSON.stringify(cacheData) },
      update: { data: JSON.stringify(cacheData) },
    });

    return NextResponse.json({
      ok: true,
      panelId,
      totalRows: result.rows.length,
      fetchedAt: cacheData.fetchedAt,
    });
  } catch (err) {
    console.error("[SF Panels] Refresh error:", err);
    return NextResponse.json({ error: "Failed to refresh panel data" }, { status: 500 });
  }
}
