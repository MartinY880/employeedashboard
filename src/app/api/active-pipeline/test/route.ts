// ProConnect — Active Pipeline: Test As User
// POST → Admin runs a panel's report with an arbitrary filter value
//        to preview what a specific user would see.

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { executeReportWithFilters } from "@/lib/salesforce-client";
import type { PipelineConfig } from "@/types/active-pipeline";

const CONFIG_ID = "active_pipeline_config";

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_ACTIVE_PIPELINE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const panelId = String(body.panelId || "");
    const testValue = String(body.testValue || "").trim();

    if (!panelId) {
      return NextResponse.json({ error: "panelId is required" }, { status: 400 });
    }
    if (!testValue) {
      return NextResponse.json({ error: "testValue (name or email) is required" }, { status: 400 });
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

    if (!panel.reportId) {
      return NextResponse.json({ error: "Panel has no report configured" }, { status: 400 });
    }

    // Build runtime filters — replace $USER filters with testValue
    let filters: { column: string; operator: string; value: string }[];
    let filterLogic: string | null | undefined;

    if (panel.reportFilters && panel.reportFilters.length > 0) {
      filters = panel.reportFilters.map((f) => {
        if (f.replaceWithUser) {
          return { column: f.column, operator: f.operator, value: testValue };
        }
        return { column: f.column, operator: f.operator, value: f.value };
      });
      filterLogic = panel.filterLogic;
    } else {
      if (!panel.filterColumn) {
        return NextResponse.json({ error: "Panel has no filter column configured" }, { status: 400 });
      }
      filters = [{ column: panel.filterColumn, operator: panel.filterOperator, value: testValue }];
    }

    const result = await executeReportWithFilters(panel.reportId, filters, filterLogic);

    // Apply visible columns + sort + column labels (same as dashboard)
    const allColumns = result.columns.map((c) => ({ name: c.name, label: c.label }));

    let columns = allColumns;
    if (panel.visibleColumns.length) {
      columns = panel.visibleColumns
        .map((name) => allColumns.find((c) => c.name === name))
        .filter(Boolean) as { name: string; label: string }[];
    }
    columns = columns.map((c) => ({
      name: c.name,
      label: panel.columnLabels[c.name] || c.label,
    }));

    let rows = result.rows;
    // Sort
    if (panel.sortColumn) {
      const colIdx = allColumns.findIndex((c) => c.name === panel.sortColumn);
      if (colIdx >= 0) {
        const dir = panel.sortDirection === "desc" ? -1 : 1;
        rows = [...rows].sort((a, b) => {
          const aVal = a.cells[colIdx]?.value ?? "";
          const bVal = b.cells[colIdx]?.value ?? "";
          const aNum = Number(aVal);
          const bNum = Number(bVal);
          if (!isNaN(aNum) && !isNaN(bNum)) return (aNum - bNum) * dir;
          return aVal.localeCompare(bVal) * dir;
        });
      }
    }
    // Filter visible columns from rows
    if (panel.visibleColumns.length) {
      const indices = panel.visibleColumns
        .map((name) => allColumns.findIndex((c) => c.name === name))
        .filter((i) => i >= 0);
      rows = rows.map((row) => ({
        cells: indices.map((i) => row.cells[i] ?? { label: "", value: "" }),
      }));
    }

    return NextResponse.json({
      ok: true,
      panelTitle: panel.title,
      testValue,
      filterColumn: panel.filterColumn,
      filterOperator: panel.filterOperator,
      filterMatchBy: panel.filterMatchBy,
      reportName: result.reportName,
      columns,
      rows,
      totalRows: rows.length,
    });
  } catch (err) {
    console.error("[Pipeline] Test error:", err);
    const message = err instanceof Error ? err.message : "Failed to run test";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
