// ProConnect — Salesforce Report Widget: Admin Settings API
// GET  → fetch current config
// PUT  → save config
// POST → describe a report (returns columns for the admin to pick)

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { describeReport, extractReportId } from "@/lib/salesforce-client";

const SETTING_ID = "sf_report_widget";

export interface SfReportWidgetConfig {
  enabled: boolean;
  title: string;
  reportUrl: string;
  reportId: string;
  reportName: string;
  visibleColumns: string[];    // API names of columns to show
  columnLabels: Record<string, string>;  // API name → custom display label
  maxRows: number;
  refreshMinutes: number;
}

const DEFAULT_CONFIG: SfReportWidgetConfig = {
  enabled: false,
  title: "Salesforce Report",
  reportUrl: "",
  reportId: "",
  reportName: "",
  visibleColumns: [],
  columnLabels: {},
  maxRows: 15,
  refreshMinutes: 30,
};

/** GET — return current widget config */
export async function GET() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_SALESFORCE_REPORT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const row = await prisma.calendarSetting.findUnique({ where: { id: SETTING_ID } });
    const config: SfReportWidgetConfig = row?.data
      ? { ...DEFAULT_CONFIG, ...JSON.parse(row.data) }
      : DEFAULT_CONFIG;

    return NextResponse.json(config);
  } catch (err) {
    console.error("[SF Widget] GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** PUT — save widget config */
export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_SALESFORCE_REPORT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    const config: SfReportWidgetConfig = {
      enabled: Boolean(body.enabled),
      title: String(body.title || "Salesforce Report").slice(0, 200),
      reportUrl: String(body.reportUrl || ""),
      reportId: String(body.reportId || ""),
      reportName: String(body.reportName || ""),
      visibleColumns: Array.isArray(body.visibleColumns) ? body.visibleColumns.map(String) : [],
      columnLabels: body.columnLabels && typeof body.columnLabels === "object" && !Array.isArray(body.columnLabels)
        ? Object.fromEntries(
            Object.entries(body.columnLabels as Record<string, unknown>)
              .filter(([, v]) => typeof v === "string" && (v as string).trim())
              .map(([k, v]) => [String(k), String(v).slice(0, 200)])
          )
        : {},
      maxRows: Math.max(1, Math.min(200, Number(body.maxRows) || 15)),
      refreshMinutes: Math.max(5, Math.min(1440, Number(body.refreshMinutes) || 30)),
    };

    await prisma.calendarSetting.upsert({
      where: { id: SETTING_ID },
      create: { id: SETTING_ID, data: JSON.stringify(config) },
      update: { data: JSON.stringify(config) },
    });

    return NextResponse.json({ ok: true, config });
  } catch (err) {
    console.error("[SF Widget] PUT error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** POST — describe a report URL (returns columns + report name) */
export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_SALESFORCE_REPORT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const reportUrl = String(body.reportUrl || "");
    const reportId = extractReportId(reportUrl);

    if (!reportId) {
      return NextResponse.json(
        { error: "Invalid Salesforce report URL or ID" },
        { status: 400 },
      );
    }

    const result = await describeReport(reportId);

    return NextResponse.json({
      reportId,
      reportName: result.reportName,
      reportFormat: result.reportFormat,
      columns: result.columns,
    });
  } catch (err) {
    console.error("[SF Widget] POST describe error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
