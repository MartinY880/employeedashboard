// ProConnect — Active Pipeline: Main API
// GET  → Dashboard: returns panels filtered by user identity + cached per-user
// PUT  → Admin: saves the full pipeline configuration

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { executeReportWithFilters } from "@/lib/salesforce-client";
import type { PipelinePanel, PipelineConfig, PipelinePanelData, ReportFilterConfig } from "@/types/active-pipeline";

const CONFIG_ID = "active_pipeline_config";
const CACHE_PREFIX = "pipeline_cache_";
const VIEW_AS_PREFIX = "pipeline_viewas_";

interface CachedPanelData {
  fetchedAt: string;
  reportName: string;
  columns: { name: string; label: string }[];
  rows: { cells: { label: string; value: string }[] }[];
  grandTotals?: { name: string; label: string; value: string }[];
}

async function loadConfig(): Promise<PipelineConfig> {
  const row = await prisma.calendarSetting.findUnique({ where: { id: CONFIG_ID } });
  if (row?.data) {
    try {
      const parsed = JSON.parse(row.data) as PipelineConfig;
      if (parsed.widgetVisible === undefined) parsed.widgetVisible = true;
      return parsed;
    } catch { /* fall through */ }
  }
  return { widgetVisible: true, panels: [] };
}

/** GET — return pipeline panels data for the dashboard (per-user filtered) */
export async function GET(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await loadConfig();

    // Admin mode: return raw config for the management page
    const url = new URL(request.url);
    if (url.searchParams.get("admin") === "1") {
      if (!hasPermission(user, PERMISSIONS.MANAGE_ACTIVE_PIPELINE)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ config });
    }

    // If widget is toggled off globally, return empty
    if (!config.widgetVisible) {
      return NextResponse.json({ panels: [] });
    }

    // Check for "View As" impersonation (admin viewing as a specific user)
    const isAdmin = hasPermission(user, PERMISSIONS.MANAGE_ACTIVE_PIPELINE);
    let viewingAs: { name: string; email: string; roles?: string[] } | null = null;
    if (isAdmin) {
      const viewAsRow = await prisma.calendarSetting.findUnique({
        where: { id: `${VIEW_AS_PREFIX}${user.sub}` },
      });
      if (viewAsRow?.data) {
        try {
          const parsed = JSON.parse(viewAsRow.data);
          if (parsed.name || parsed.email) {
            viewingAs = {
              name: parsed.name || "",
              email: parsed.email || "",
              roles: Array.isArray(parsed.roles) ? parsed.roles : undefined,
            };
          }
        } catch { /* ignore */ }
      }
    }

    // Effective roles for panel visibility
    const effectiveRoles = viewingAs?.roles && viewingAs.roles.length > 0
      ? viewingAs.roles
      : user.logtoRoles ?? [];

    const enabledPanels = config.panels
      .filter((p) => {
        if (!p.enabled || !p.reportId) return false;
        // Has new-style report filters with at least one user replacement?
        const hasReportFilters = p.reportFilters?.some((f) => f.replaceWithUser);
        // Or has legacy single-filter configured?
        return hasReportFilters || !!p.filterColumn;
      })
      .sort((a, b) => a.order - b.order)
      .filter((p) => {
        if (p.visibleToSuperAdminOnly) {
          return user.role === "SUPER_ADMIN";
        }
        if (!p.visibleToRoles || p.visibleToRoles.length === 0) return true;
        // When impersonating with roles, use those instead of admin bypass
        if (viewingAs?.roles && viewingAs.roles.length > 0) {
          return p.visibleToRoles.some((r) => effectiveRoles.includes(r));
        }
        if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
        return p.visibleToRoles.some((r) => effectiveRoles.includes(r));
      });

    if (enabledPanels.length === 0) {
      return NextResponse.json({
        panels: [],
        ...(isAdmin ? { canViewAs: true } : {}),
        ...(viewingAs ? { viewingAs } : {}),
      });
    }

    // Determine the filter value — use impersonated user if active, else real user
    const userName = viewingAs?.name || user.name || "";
    const userEmail = viewingAs?.email || user.email || "";
    // Cache key uses the effective identity, not the admin's own identity when impersonating
    const cacheIdentity = viewingAs ? `viewas_${userName}_${userEmail}` : user.sub;

    // Fetch data for each panel (parallel, per-user cache)
    const panelDataPromises = enabledPanels.map((panel) =>
      loadPanelData(panel, userName, userEmail, cacheIdentity),
    );
    const results = await Promise.allSettled(panelDataPromises);

    const panels: PipelinePanelData[] = results
      .map((r, i) => {
        if (r.status === "fulfilled") return r.value;
        console.error(`[Pipeline] Failed to load panel ${enabledPanels[i].id}:`, r.reason);
        return null;
      })
      .filter(Boolean) as PipelinePanelData[];

    return NextResponse.json({
      panels,
      ...(isAdmin ? { canViewAs: true } : {}),
      ...(viewingAs ? { viewingAs } : {}),
    });
  } catch (err) {
    console.error("[Pipeline] GET error:", err);
    return NextResponse.json({ error: "Failed to load pipeline data" }, { status: 500 });
  }
}

/** PUT — admin saves complete pipeline configuration */
export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_ACTIVE_PIPELINE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    if (!body || !Array.isArray(body.panels)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const panels: PipelinePanel[] = body.panels.map((p: Record<string, unknown>, idx: number) =>
      sanitizePanel(p, idx),
    );

    const widgetVisible = body.widgetVisible !== false;
    const config: PipelineConfig = { widgetVisible, panels };

    await prisma.calendarSetting.upsert({
      where: { id: CONFIG_ID },
      create: { id: CONFIG_ID, data: JSON.stringify(config) },
      update: { data: JSON.stringify(config) },
    });

    return NextResponse.json({ ok: true, panels });
  } catch (err) {
    console.error("[Pipeline] PUT error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────

function sanitizePanel(p: Record<string, unknown>, idx: number): PipelinePanel {
  return {
    id: String(p.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
    enabled: Boolean(p.enabled),
    title: String(p.title || "Report").slice(0, 200),
    displayMode: p.displayMode === "stat" ? "stat" : p.displayMode === "chart" ? "chart" : "table",
    reportUrl: String(p.reportUrl || ""),
    reportId: String(p.reportId || ""),
    reportName: String(p.reportName || ""),
    visibleColumns: Array.isArray(p.visibleColumns) ? p.visibleColumns.map(String) : [],
    columnLabels:
      p.columnLabels && typeof p.columnLabels === "object" && !Array.isArray(p.columnLabels)
        ? Object.fromEntries(
            Object.entries(p.columnLabels as Record<string, unknown>)
              .filter(([, v]) => typeof v === "string" && (v as string).trim())
              .map(([k, v]) => [String(k), String(v).slice(0, 200)]),
          )
        : {},
    maxRows: Math.max(1, Math.min(200, Number(p.maxRows) || 25)),
    refreshMinutes: Math.max(5, Math.min(1440, Number(p.refreshMinutes) || 15)),
    highlightTopN: Math.max(0, Math.min(10, Number(p.highlightTopN) || 0)),
    statColumn: p.statColumn ? String(p.statColumn) : undefined,
    statLabel: p.statLabel ? String(p.statLabel).slice(0, 200) : undefined,
    chartValueColumn: p.chartValueColumn ? String(p.chartValueColumn) : undefined,
    chartLabelColumn: p.chartLabelColumn ? String(p.chartLabelColumn) : undefined,
    sortColumn: p.sortColumn ? String(p.sortColumn) : undefined,
    sortDirection: p.sortDirection === "desc" ? "desc" : "asc",
    visibleToRoles: Array.isArray(p.visibleToRoles) ? p.visibleToRoles.map(String).filter(Boolean) : [],
    visibleToSuperAdminOnly: Boolean(p.visibleToSuperAdminOnly),
    filterColumn: String(p.filterColumn || ""),
    filterMatchBy: p.filterMatchBy === "email" ? "email" : "name",
    filterOperator: p.filterOperator === "contains" ? "contains" : "equals",
    reportFilters: Array.isArray(p.reportFilters)
      ? (p.reportFilters as Record<string, unknown>[]).map((f) => ({
          column: String(f.column || ""),
          operator: String(f.operator || "equals"),
          value: String(f.value || ""),
          replaceWithUser: Boolean(f.replaceWithUser),
          matchBy: f.matchBy === "email" ? "email" as const : "name" as const,
        } satisfies ReportFilterConfig))
      : undefined,
    filterLogic: p.filterLogic ? String(p.filterLogic) : undefined,
    order: Number.isFinite(Number(p.order)) ? Number(p.order) : idx,
  };
}

async function loadPanelData(
  panel: PipelinePanel,
  userName: string,
  userEmail: string,
  userId: string,
): Promise<PipelinePanelData> {
  // Per-user cache key
  const cacheId = `${CACHE_PREFIX}${panel.id}_${userId}`;
  const cacheRow = await prisma.calendarSetting.findUnique({ where: { id: cacheId } });

  let cached: CachedPanelData | null = null;
  if (cacheRow?.data) {
    try {
      cached = JSON.parse(cacheRow.data);
    } catch { /* invalid cache */ }
  }

  const refreshMs = (panel.refreshMinutes ?? 15) * 60 * 1000;
  const isFresh =
    cached?.fetchedAt && Date.now() - new Date(cached.fetchedAt).getTime() < refreshMs;

  if (!isFresh) {
    try {
      // Build the runtime filters
      let filters: { column: string; operator: string; value: string }[];
      let filterLogic: string | null | undefined;

      if (panel.reportFilters && panel.reportFilters.length > 0) {
        // New-style: use report's built-in filters, replacing $USER where configured
        filters = panel.reportFilters.map((f) => {
          if (f.replaceWithUser) {
            const replacement = f.matchBy === "email" ? userEmail : userName;
            return { column: f.column, operator: f.operator, value: replacement };
          }
          return { column: f.column, operator: f.operator, value: f.value };
        });
        filterLogic = panel.filterLogic;
      } else {
        // Legacy single-filter approach
        const filterValue = panel.filterMatchBy === "email" ? userEmail : userName;
        if (!filterValue) {
          throw new Error(`No ${panel.filterMatchBy} available for user`);
        }
        filters = [{ column: panel.filterColumn, operator: panel.filterOperator, value: filterValue }];
      }

      const result = await executeReportWithFilters(panel.reportId, filters, filterLogic);

      cached = {
        fetchedAt: new Date().toISOString(),
        reportName: result.reportName,
        columns: result.columns.map((c) => ({ name: c.name, label: c.label })),
        rows: result.rows,
        grandTotals: result.grandTotals,
      };

      await prisma.calendarSetting.upsert({
        where: { id: cacheId },
        create: { id: cacheId, data: JSON.stringify(cached) },
        update: { data: JSON.stringify(cached) },
      });
    } catch (err) {
      if (!cached) throw err;
      console.warn(`[Pipeline] Failed to refresh panel ${panel.id} for user ${userId}, using stale cache`);
    }
  }

  if (!cached) {
    return {
      id: panel.id,
      title: panel.title,
      displayMode: panel.displayMode,
      highlightTopN: panel.highlightTopN,
    };
  }

  const columns = filterColumns(cached.columns, panel.visibleColumns, panel.columnLabels);
  const sorted = sortRows(cached.rows, cached.columns, panel.sortColumn, panel.sortDirection);
  const rows = filterRows(sorted, cached.columns, panel.visibleColumns, panel.maxRows);

  let statValue: string | undefined;
  let statLabel: string | undefined;
  if (panel.displayMode === "stat") {
    statLabel = panel.statLabel || panel.title;
    // Try grand totals first (for SUMMARY reports showing a total)
    if (panel.statColumn && cached.grandTotals?.length) {
      const gt = cached.grandTotals.find((g) => g.name === panel.statColumn);
      if (gt) statValue = gt.label;
    }
    // Fall back to first row data
    if (!statValue && panel.statColumn && cached.columns.length) {
      const colIdx = cached.columns.findIndex((c) => c.name === panel.statColumn);
      statValue = colIdx >= 0 ? cached.rows[0]?.cells[colIdx]?.label || cached.rows[0]?.cells[colIdx]?.value : undefined;
    }
    // Last resort: first cell of first row
    if (!statValue && cached.rows[0]?.cells[0]) {
      statValue = cached.rows[0].cells[0].label || cached.rows[0].cells[0].value;
    }
    // If still no value but we have grand totals, use the first one
    if (!statValue && cached.grandTotals?.[0]) {
      statValue = cached.grandTotals[0].label;
    }
  }

  // Build chart data: label from first column (grouping), value from chartValueColumn
  let chartData: { label: string; value: number }[] | undefined;
  if (panel.displayMode === "chart" && cached.rows.length > 0) {
    const labelColIdx = panel.chartLabelColumn
      ? cached.columns.findIndex((c) => c.name === panel.chartLabelColumn)
      : 0;
    const valueColIdx = panel.chartValueColumn
      ? cached.columns.findIndex((c) => c.name === panel.chartValueColumn)
      : cached.columns.length - 1; // default to last column (often RowCount)
    chartData = cached.rows.map((row) => ({
      label: row.cells[Math.max(0, labelColIdx)]?.label || "Unknown",
      value: Number(row.cells[Math.max(0, valueColIdx)]?.value) || 0,
    })).filter((d) => d.value > 0);
  }

  return {
    id: panel.id,
    title: panel.title,
    displayMode: panel.displayMode,
    highlightTopN: panel.highlightTopN,
    columns,
    rows,
    totalRows: cached.rows.length,
    maxRows: panel.maxRows,
    statValue,
    statLabel,
    chartData,
    grandTotals: cached.grandTotals,
    fetchedAt: cached.fetchedAt,
  };
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

function filterRows(
  allRows: { cells: { label: string; value: string }[] }[],
  allColumns: { name: string; label: string }[],
  visibleColumns: string[],
  maxRows: number,
): { cells: { label: string; value: string }[] }[] {
  let rows = allRows;
  if (visibleColumns.length) {
    const indices = visibleColumns
      .map((name) => allColumns.findIndex((c) => c.name === name))
      .filter((i) => i >= 0);
    rows = rows.map((row) => ({
      cells: indices.map((i) => row.cells[i] ?? { label: "", value: "" }),
    }));
  }
  return rows.slice(0, maxRows);
}
