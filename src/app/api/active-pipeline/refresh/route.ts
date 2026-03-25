// ProConnect — Active Pipeline: Force Refresh
// POST → Admin force-refreshes a specific panel's cached data (for the admin user)

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { executeReportWithFilters } from "@/lib/salesforce-client";
import type { PipelineConfig } from "@/types/active-pipeline";

const CONFIG_ID = "active_pipeline_config";
const CACHE_PREFIX = "pipeline_cache_";

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_ACTIVE_PIPELINE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const panelId = String(body.panelId || "");

    if (!panelId) {
      return NextResponse.json({ error: "panelId is required" }, { status: 400 });
    }

    const row = await prisma.calendarSetting.findUnique({ where: { id: CONFIG_ID } });
    if (!row?.data) {
      return NextResponse.json({ error: "No panels configured" }, { status: 400 });
    }

    const config: PipelineConfig = JSON.parse(row.data);
    const panel = config.panels.find((p) => p.id === panelId);

    if (!panel) {
      return NextResponse.json({ error: "Panel not found" }, { status: 404 });
    }

    if (!panel.reportId || !panel.filterColumn) {
      return NextResponse.json({ error: "Panel has no report or filter column configured" }, { status: 400 });
    }

    // Use the admin user's own identity for preview
    const filterValue = panel.filterMatchBy === "email"
      ? (user.email || "")
      : (user.name || "");

    if (!filterValue) {
      return NextResponse.json({ error: `No ${panel.filterMatchBy} available for current user` }, { status: 400 });
    }

    const result = await executeReportWithFilters(panel.reportId, [
      {
        column: panel.filterColumn,
        operator: panel.filterOperator,
        value: filterValue,
      },
    ]);

    const cacheData = {
      fetchedAt: new Date().toISOString(),
      reportName: result.reportName,
      columns: result.columns.map((c) => ({ name: c.name, label: c.label })),
      rows: result.rows,
    };

    const cacheId = `${CACHE_PREFIX}${panelId}_${user.sub}`;
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
    console.error("[Pipeline] Refresh error:", err);
    return NextResponse.json({ error: "Failed to refresh panel data" }, { status: 500 });
  }
}
