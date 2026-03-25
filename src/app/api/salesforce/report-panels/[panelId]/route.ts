// ProConnect — Salesforce Report Panels: Full Panel Data
// GET → returns ALL rows for a specific panel (no maxRows truncation)
// Accessible to all authenticated users

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { prisma } from "@/lib/prisma";
import type { SfReportPanelsConfig } from "@/types/salesforce-panels";

const PANELS_ID = "sf_report_panels";
const CACHE_PREFIX = "sf_panel_cache_";

interface CachedPanelData {
  fetchedAt: string;
  reportName: string;
  columns: { name: string; label: string }[];
  rows: { cells: { label: string; value: string }[] }[];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ panelId: string }> },
) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { panelId } = await params;

    // Load panel config to get visibleColumns / columnLabels
    const configRow = await prisma.calendarSetting.findUnique({ where: { id: PANELS_ID } });
    if (!configRow?.data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const config: SfReportPanelsConfig = JSON.parse(configRow.data);
    const panel = config.panels.find((p) => p.id === panelId && p.enabled);
    if (!panel) {
      return NextResponse.json({ error: "Panel not found" }, { status: 404 });
    }
    if (panel.visibleToSuperAdminOnly && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Panel not found" }, { status: 404 });
    }
    if (!panel.visibleToSuperAdminOnly && panel.visibleToRoles?.length) {
      const effectiveRoles = user.logtoRoles ?? [];
      if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN" && !panel.visibleToRoles.some((role) => effectiveRoles.includes(role))) {
        return NextResponse.json({ error: "Panel not found" }, { status: 404 });
      }
    }

    // Load cached data
    const cacheId = CACHE_PREFIX + panelId;
    const cacheRow = await prisma.calendarSetting.findUnique({ where: { id: cacheId } });
    if (!cacheRow?.data) {
      return NextResponse.json({ error: "No data available" }, { status: 404 });
    }

    let cached: CachedPanelData;
    try {
      cached = JSON.parse(cacheRow.data);
    } catch {
      return NextResponse.json({ error: "Invalid cache" }, { status: 500 });
    }

    // Sort rows, filter columns, return ALL rows (no maxRows truncation)
    const columns = filterColumns(cached.columns, panel.visibleColumns, panel.columnLabels);
    const sorted = sortRows(cached.rows, cached.columns, panel.sortColumn, panel.sortDirection);
    const rows = filterRows(sorted, cached.columns, panel.visibleColumns);

    return NextResponse.json({
      title: panel.title,
      columns,
      rows,
      totalRows: rows.length,
      highlightTopN: panel.highlightTopN,
      fetchedAt: cached.fetchedAt,
    });
  } catch (err) {
    console.error("[SF Panels] Panel detail GET error:", err);
    return NextResponse.json({ error: "Failed to load panel data" }, { status: 500 });
  }
}

function sortRows(
  rows: { cells: { label: string; value: string }[] }[],
  allColumns: { name: string; label: string }[],
  sortColumn?: string,
  sortDirection?: "asc" | "desc",
): { cells: { label: string; value: string }[] }[] {
  if (!sortColumn) return rows;
  const colIdx = allColumns.findIndex((c) => c.name === sortColumn);
  if (colIdx < 0) return rows;
  const dir = sortDirection === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const aVal = a.cells[colIdx]?.value ?? "";
    const bVal = b.cells[colIdx]?.value ?? "";
    const aNum = Number(aVal);
    const bNum = Number(bVal);
    if (!isNaN(aNum) && !isNaN(bNum)) return (aNum - bNum) * dir;
    return aVal.localeCompare(bVal) * dir;
  });
}

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
): { cells: { label: string; value: string }[] }[] {
  if (!visibleColumns.length) return allRows;
  const indices = visibleColumns
    .map((name) => allColumns.findIndex((c) => c.name === name))
    .filter((i) => i >= 0);
  return allRows.map((row) => ({
    cells: indices.map((i) => row.cells[i] ?? { label: "", value: "" }),
  }));
}
