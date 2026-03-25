// ProConnect — Salesforce Report Panels: Main API
// GET  → Public: returns all enabled panels' data for the dashboard
// PUT  → Admin: saves the full panels configuration

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { executeReport } from "@/lib/salesforce-client";
import type { SfReportPanel, SfReportPanelsConfig, PanelData } from "@/types/salesforce-panels";
import type { SfReportWidgetConfig } from "../report-widget/route";

const PANELS_ID = "sf_report_panels";
const CACHE_PREFIX = "sf_panel_cache_";
const VIEW_AS_PREFIX = "pipeline_viewas_";

// Legacy single-widget IDs (for migration)
const LEGACY_SETTING_ID = "sf_report_widget";

interface CachedPanelData {
  fetchedAt: string;
  reportName: string;
  columns: { name: string; label: string }[];
  rows: { cells: { label: string; value: string }[] }[];
  grandTotals?: { name: string; label: string; value: string }[];
}

/** Load panels config, migrating from legacy single-widget if needed */
async function loadPanelsConfig(): Promise<SfReportPanelsConfig> {
  const row = await prisma.calendarSetting.findUnique({ where: { id: PANELS_ID } });
  if (row?.data) {
    try {
      const parsed = JSON.parse(row.data) as SfReportPanelsConfig;
      // Backfill fields for configs saved before they existed
      if (parsed.widgetVisible === undefined) parsed.widgetVisible = true;
      // Migrate highlightTop3 → highlightTopN on each panel
      for (const p of parsed.panels) {
        if ((p as unknown as Record<string, unknown>).highlightTop3 !== undefined && (p.highlightTopN === undefined || p.highlightTopN === 0)) {
          p.highlightTopN = (p as unknown as Record<string, unknown>).highlightTop3 ? 3 : 0;
        }
      }
      return parsed;
    } catch { /* fall through */ }
  }

  // Check for legacy single-widget config and migrate
  const legacyRow = await prisma.calendarSetting.findUnique({ where: { id: LEGACY_SETTING_ID } });
  if (legacyRow?.data) {
    try {
      const legacy: SfReportWidgetConfig = JSON.parse(legacyRow.data);
      if (legacy.reportId) {
        const migratedPanel: SfReportPanel = {
          id: crypto.randomUUID(),
          enabled: legacy.enabled,
          title: legacy.title || "Salesforce Report",
          displayMode: "table",
          reportUrl: legacy.reportUrl,
          reportId: legacy.reportId,
          reportName: legacy.reportName,
          visibleColumns: legacy.visibleColumns,
          columnLabels: legacy.columnLabels,
          maxRows: legacy.maxRows,
          refreshMinutes: legacy.refreshMinutes,
          highlightTopN: 3,
          order: 0,
        };
        const config: SfReportPanelsConfig = { widgetVisible: true, panels: [migratedPanel] };
        // Persist migration
        await prisma.calendarSetting.upsert({
          where: { id: PANELS_ID },
          create: { id: PANELS_ID, data: JSON.stringify(config) },
          update: { data: JSON.stringify(config) },
        });
        return config;
      }
    } catch { /* fall through */ }
  }

  return { widgetVisible: true, panels: [] };
}

/** GET — return panels data; ?admin=1 returns raw config for the admin page */
export async function GET(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await loadPanelsConfig();

    // Admin mode: return raw config for the management page
    const url = new URL(request.url);
    if (url.searchParams.get("admin") === "1") {
      if (!user || !hasPermission(user, PERMISSIONS.MANAGE_SALESFORCE_REPORT)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ config });
    }

    // If widget is toggled off globally, return empty
    if (!config.widgetVisible) {
      return NextResponse.json({ panels: [] });
    }

    // Check for "View As" impersonation (shared with active-pipeline)
    let viewAsRoles: string[] | null = null;
    if (user && hasPermission(user, PERMISSIONS.MANAGE_ACTIVE_PIPELINE)) {
      const viewAsRow = await prisma.calendarSetting.findUnique({
        where: { id: `${VIEW_AS_PREFIX}${user.sub}` },
      });
      if (viewAsRow?.data) {
        try {
          const parsed = JSON.parse(viewAsRow.data);
          if (Array.isArray(parsed.roles) && parsed.roles.length > 0) {
            viewAsRoles = parsed.roles;
          }
        } catch { /* ignore */ }
      }
    }

    const effectiveRoles = viewAsRoles ?? (user?.logtoRoles ?? []);

    const enabledPanels = config.panels
      .filter((p) => p.enabled && p.reportId)
      .sort((a, b) => a.order - b.order)
      .filter((p) => {
        if (p.visibleToSuperAdminOnly) {
          return user?.role === "SUPER_ADMIN";
        }
        // If no visibleToRoles restriction, everyone sees it
        if (!p.visibleToRoles || p.visibleToRoles.length === 0) return true;
        // When impersonating with roles, use those instead of admin bypass
        if (viewAsRoles) {
          return p.visibleToRoles.some((r) => effectiveRoles.includes(r));
        }
        // Admins always see all panels
        if (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") return true;
        // Check if any of the user's Logto roles match
        return p.visibleToRoles.some((r) => effectiveRoles.includes(r));
      });

    if (enabledPanels.length === 0) {
      return NextResponse.json({ panels: [] });
    }

    // Fetch data for each panel (parallel, with cache)
    const panelDataPromises = enabledPanels.map((panel) => loadPanelData(panel));
    const results = await Promise.allSettled(panelDataPromises);

    const panels: PanelData[] = results
      .map((r, i) => {
        if (r.status === "fulfilled") return r.value;
        console.error(`[SF Panels] Failed to load panel ${enabledPanels[i].id}:`, r.reason);
        return null;
      })
      .filter(Boolean) as PanelData[];

    return NextResponse.json({ panels });
  } catch (err) {
    console.error("[SF Panels] GET error:", err);
    return NextResponse.json({ error: "Failed to load panels" }, { status: 500 });
  }
}

/** PUT — admin saves complete panels configuration */
export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_SALESFORCE_REPORT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    if (!body || !Array.isArray(body.panels)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const panels: SfReportPanel[] = body.panels.map((p: Record<string, unknown>, idx: number) =>
      sanitizePanel(p, idx),
    );

    const widgetVisible = body.widgetVisible !== false;
    const config: SfReportPanelsConfig = { widgetVisible, panels };

    await prisma.calendarSetting.upsert({
      where: { id: PANELS_ID },
      create: { id: PANELS_ID, data: JSON.stringify(config) },
      update: { data: JSON.stringify(config) },
    });

    return NextResponse.json({ ok: true, panels });
  } catch (err) {
    console.error("[SF Panels] PUT error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────

function sanitizePanel(p: Record<string, unknown>, idx: number): SfReportPanel {
  return {
    id: String(p.id || crypto.randomUUID()),
    enabled: Boolean(p.enabled),
    title: String(p.title || "Report").slice(0, 200),
    displayMode: p.displayMode === "stat" ? "stat" : "table",
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
    maxRows: Math.max(1, Math.min(200, Number(p.maxRows) || 15)),
    refreshMinutes: Math.max(5, Math.min(1440, Number(p.refreshMinutes) || 30)),
    highlightTopN: Math.max(0, Math.min(10, Number(p.highlightTopN) || (p.highlightTop3 ? 3 : 0))),
    statColumn: p.statColumn ? String(p.statColumn) : undefined,
    statLabel: p.statLabel ? String(p.statLabel).slice(0, 200) : undefined,
    sortColumn: p.sortColumn ? String(p.sortColumn) : undefined,
    sortDirection: p.sortDirection === "desc" ? "desc" : "asc",
    visibleToRoles: Array.isArray(p.visibleToRoles) ? p.visibleToRoles.map(String).filter(Boolean) : [],
    visibleToSuperAdminOnly: Boolean(p.visibleToSuperAdminOnly),
    order: Number.isFinite(Number(p.order)) ? Number(p.order) : idx,
  };
}

async function loadPanelData(panel: SfReportPanel): Promise<PanelData> {
  const cacheId = CACHE_PREFIX + panel.id;
  const cacheRow = await prisma.calendarSetting.findUnique({ where: { id: cacheId } });

  let cached: CachedPanelData | null = null;
  if (cacheRow?.data) {
    try {
      cached = JSON.parse(cacheRow.data);
    } catch { /* invalid cache */ }
  }

  const refreshMs = (panel.refreshMinutes ?? 30) * 60 * 1000;
  const isFresh =
    cached?.fetchedAt && Date.now() - new Date(cached.fetchedAt).getTime() < refreshMs;

  if (!isFresh) {
    // Fetch fresh data
    try {
      const result = await executeReport(panel.reportId);
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
      // Fall back to stale cache if available
      if (!cached) throw err;
      console.warn(`[SF Panels] Failed to refresh panel ${panel.id}, using stale cache`);
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

  // For stat mode, pull the first cell of first row (or specified column)
  let statValue: string | undefined;
  let statLabel: string | undefined;
  if (panel.displayMode === "stat") {
    statLabel = panel.statLabel || panel.title;
    // Try grand totals first (for SUMMARY/MULTI_BLOCK reports)
    if (panel.statColumn && cached.grandTotals?.length) {
      const gt = cached.grandTotals.find((g) => g.name === panel.statColumn);
      if (gt) statValue = gt.label;
    }
    // Fall back to first row data
    if (!statValue && panel.statColumn && cached.columns.length) {
      const colIdx = cached.columns.findIndex((c) => c.name === panel.statColumn);
      statValue = colIdx >= 0 ? cached.rows[0]?.cells[colIdx]?.label || cached.rows[0]?.cells[colIdx]?.value : undefined;
    }
    if (!statValue && cached.rows[0]?.cells[0]) {
      statValue = cached.rows[0].cells[0].label || cached.rows[0].cells[0].value;
    }
    // Last resort: first grand total
    if (!statValue && cached.grandTotals?.[0]) {
      statValue = cached.grandTotals[0].label;
    }
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
    // Try numeric comparison first
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
