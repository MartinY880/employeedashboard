// ProConnect — Salesforce Report Widget: Public Data Endpoint
// GET → returns cached report data for the dashboard widget
// Accessible to all authenticated users (no admin permission needed)

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { prisma } from "@/lib/prisma";
import { executeReport } from "@/lib/salesforce-client";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import type { SfReportWidgetConfig } from "../report-widget/route";

const SETTING_ID = "sf_report_widget";
const CACHE_ID = "sf_report_widget_cache";

interface CachedData {
  fetchedAt: string;
  reportName: string;
  columns: { name: string; label: string }[];
  rows: { cells: { label: string; value: string }[] }[];
}

/** GET — return report data (cached, refreshed based on config interval) */
export async function GET() {
  try {
    const { isAuthenticated } = await getAuthUser();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Load config
    const cfgRow = await prisma.calendarSetting.findUnique({ where: { id: SETTING_ID } });
    if (!cfgRow?.data) {
      return NextResponse.json({ enabled: false });
    }

    const config: SfReportWidgetConfig = JSON.parse(cfgRow.data);
    if (!config.enabled || !config.reportId) {
      return NextResponse.json({ enabled: false });
    }

    // Check cache freshness
    const cacheRow = await prisma.calendarSetting.findUnique({ where: { id: CACHE_ID } });
    let cached: CachedData | null = null;

    if (cacheRow?.data) {
      try {
        cached = JSON.parse(cacheRow.data);
      } catch { /* invalid cache */ }
    }

    const refreshMs = (config.refreshMinutes ?? 30) * 60 * 1000;
    const isFresh =
      cached?.fetchedAt &&
      Date.now() - new Date(cached.fetchedAt).getTime() < refreshMs;

    if (isFresh && cached) {
      return NextResponse.json({
        enabled: true,
        title: config.title,
        columns: filterColumns(cached.columns, config.visibleColumns, config.columnLabels),
        rows: filterRows(cached.rows, cached.columns, config.visibleColumns, config.maxRows),
        totalRows: cached.rows.length,
        maxRows: config.maxRows,
        fetchedAt: cached.fetchedAt,
        fromCache: true,
      });
    }

    // Fetch fresh data from Salesforce
    const result = await executeReport(config.reportId);

    const allColumns = result.columns.map((c) => ({ name: c.name, label: c.label }));
    const allRows = result.rows;

    // Cache it
    const cacheData: CachedData = {
      fetchedAt: new Date().toISOString(),
      reportName: result.reportName,
      columns: allColumns,
      rows: allRows,
    };

    await prisma.calendarSetting.upsert({
      where: { id: CACHE_ID },
      create: { id: CACHE_ID, data: JSON.stringify(cacheData) },
      update: { data: JSON.stringify(cacheData) },
    });

    return NextResponse.json({
      enabled: true,
      title: config.title,
      columns: filterColumns(allColumns, config.visibleColumns, config.columnLabels),
      rows: filterRows(allRows, allColumns, config.visibleColumns, config.maxRows),
      totalRows: allRows.length,
      maxRows: config.maxRows,
      fetchedAt: cacheData.fetchedAt,
      fromCache: false,
    });
  } catch (err) {
    console.error("[SF Widget Data] error:", err);
    return NextResponse.json({ error: "Failed to fetch report data" }, { status: 500 });
  }
}

/** POST — admin force-refresh: re-execute the report, update cache, return fresh data */
export async function POST() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_SALESFORCE_REPORT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cfgRow = await prisma.calendarSetting.findUnique({ where: { id: SETTING_ID } });
    if (!cfgRow?.data) {
      return NextResponse.json({ error: "Widget not configured" }, { status: 400 });
    }

    const config: SfReportWidgetConfig = JSON.parse(cfgRow.data);
    if (!config.reportId) {
      return NextResponse.json({ error: "No report ID configured" }, { status: 400 });
    }

    const result = await executeReport(config.reportId);

    const allColumns = result.columns.map((c) => ({ name: c.name, label: c.label }));
    const allRows = result.rows;

    const cacheData: CachedData = {
      fetchedAt: new Date().toISOString(),
      reportName: result.reportName,
      columns: allColumns,
      rows: allRows,
    };

    await prisma.calendarSetting.upsert({
      where: { id: CACHE_ID },
      create: { id: CACHE_ID, data: JSON.stringify(cacheData) },
      update: { data: JSON.stringify(cacheData) },
    });

    return NextResponse.json({
      ok: true,
      totalRows: allRows.length,
      fetchedAt: cacheData.fetchedAt,
    });
  } catch (err) {
    console.error("[SF Widget Data] force-refresh error:", err);
    return NextResponse.json({ error: "Failed to refresh report data" }, { status: 500 });
  }
}

// ─── Helpers ───────────────────────────────────────────

function filterColumns(
  allColumns: { name: string; label: string }[],
  visibleColumns: string[],
  columnLabels: Record<string, string> = {},
): { name: string; label: string }[] {
  const cols = visibleColumns.length
    ? visibleColumns
        .map((name) => allColumns.find((c) => c.name === name))
        .filter(Boolean) as { name: string; label: string }[]
    : allColumns;
  return cols.map((c) => ({
    name: c.name,
    label: columnLabels[c.name] || c.label,
  }));
}

function filterRows(
  allRows: { cells: { label: string; value: string }[] }[],
  allColumns: { name: string; label: string }[],
  visibleColumns: string[],
  maxRows: number,
): { cells: { label: string; value: string }[] }[] {
  let rows = allRows;

  // Filter columns
  if (visibleColumns.length) {
    const indices = visibleColumns
      .map((name) => allColumns.findIndex((c) => c.name === name))
      .filter((i) => i >= 0);
    rows = rows.map((row) => ({
      cells: indices.map((i) => row.cells[i] ?? { label: "", value: "" }),
    }));
  }

  // Limit rows
  return rows.slice(0, maxRows);
}
