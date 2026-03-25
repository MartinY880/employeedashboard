// ProConnect — Active Pipeline: Main API
// GET  → Dashboard: returns panels filtered by user identity + cached per-user
// PUT  → Admin: saves the full pipeline configuration

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { executeReportWithFilters } from "@/lib/salesforce-client";
import { findUserByIdentity, getUserRoles, isM2MConfigured } from "@/lib/logto-management";
import type { PipelinePanel, PipelineConfig, PipelinePanelData, ReportFilterConfig } from "@/types/active-pipeline";

const CONFIG_ID = "active_pipeline_config";
const CACHE_PREFIX = "pipeline_cache_";
const VIEW_AS_PREFIX = "pipeline_viewas_";
const AUTO_VIEW_AS_ENABLED_PREFIX = "pipeline_viewas_auto_enabled_";
const AUTO_VIEW_AS_NONCE_PREFIX = "pipeline_viewas_auto_nonce_";
const AUTO_VIEW_AS_POOL_CACHE_ID = "active_pipeline_view_as_auto_pool_v1";
const AUTO_VIEW_AS_POOL_TTL_MS = 6 * 60 * 60 * 1000;
const AUTO_VIEW_AS_SOURCE_LIMIT = 120;
const AUTO_VIEW_AS_POOL_SIZE = 40;

function normalizeRoleToken(role: string): string {
  return role.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

interface CachedPanelData {
  fetchedAt: string;
  reportName: string;
  columns: { name: string; label: string }[];
  rows: { cells: { label: string; value: string }[] }[];
  grandTotals?: { name: string; label: string; value: string }[];
}

interface ViewAsIdentity {
  name: string;
  email: string;
  roles?: string[];
}

interface AutoViewAsPoolCache {
  fetchedAt: string;
  users: ViewAsIdentity[];
}

interface AutoViewAsNonceData {
  nonce: number;
}

interface AutoViewAsEnabledData {
  enabled: boolean;
}

function stableHash32(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getHourBucket(nowMs: number): number {
  return Math.floor(nowMs / 3_600_000);
}

function nextHourBoundaryIso(nowMs: number): string {
  return new Date((getHourBucket(nowMs) + 1) * 3_600_000).toISOString();
}

function pickHourlyRotatingIdentity(
  candidates: ViewAsIdentity[],
  seed: string,
  nowMs: number,
): ViewAsIdentity | null {
  if (candidates.length === 0) return null;
  const bucket = getHourBucket(nowMs);
  const idx = stableHash32(`${seed}:${bucket}`) % candidates.length;
  return candidates[idx] ?? null;
}

function hasVisiblePanelForRoles(
  panels: PipelinePanel[],
  roles: string[],
): boolean {
  const normalizedRoles = new Set(roles.map(normalizeRoleToken));
  return panels.some((p) => {
    if (!p.enabled || !p.reportId || p.visibleToSuperAdminOnly) return false;
    const hasReportFilters = p.reportFilters?.some((f) => f.replaceWithUser);
    if (!hasReportFilters && !p.filterColumn) return false;
    if (!p.visibleToRoles || p.visibleToRoles.length === 0) return true;
    return p.visibleToRoles.some((r) => normalizedRoles.has(normalizeRoleToken(r)));
  });
}

async function loadAutoViewAsPool(): Promise<ViewAsIdentity[]> {
  if (!isM2MConfigured) return [];

  const cacheRow = await prisma.calendarSetting.findUnique({ where: { id: AUTO_VIEW_AS_POOL_CACHE_ID } });
  if (cacheRow?.data) {
    try {
      const parsed = JSON.parse(cacheRow.data) as AutoViewAsPoolCache;
      const isFresh = Date.now() - new Date(parsed.fetchedAt).getTime() < AUTO_VIEW_AS_POOL_TTL_MS;
      if (isFresh && Array.isArray(parsed.users) && parsed.users.length > 0) {
        return parsed.users;
      }
    } catch {
      // Ignore malformed cache payload.
    }
  }

  const snapshots = await prisma.directorySnapshot.findMany({
    where: {
      OR: [
        { mail: { not: "" } },
        { userPrincipalName: { not: "" } },
      ],
    },
    select: {
      displayName: true,
      mail: true,
      userPrincipalName: true,
    },
    orderBy: { displayName: "asc" },
    take: AUTO_VIEW_AS_SOURCE_LIMIT,
  });

  const seenEmails = new Set<string>();
  const users: ViewAsIdentity[] = [];

  for (const row of snapshots) {
    const email = (row.mail || row.userPrincipalName || "").trim();
    if (!email) continue;

    const emailKey = email.toLowerCase();
    if (seenEmails.has(emailKey)) continue;

    try {
      const logtoUser = await findUserByIdentity(email, row.displayName);
      if (!logtoUser) continue;

      const roles = await getUserRoles(logtoUser.id);
      const normalizedRoles = Array.from(new Set(
        roles
          .map((r) => normalizeRoleToken(r.name))
          .filter(Boolean),
      ));
      if (normalizedRoles.length === 0) continue;

      users.push({
        name: row.displayName || email,
        email,
        roles: normalizedRoles,
      });
      seenEmails.add(emailKey);

      if (users.length >= AUTO_VIEW_AS_POOL_SIZE) break;
    } catch {
      // Keep auto-pool construction resilient to per-user lookup failures.
      continue;
    }
  }

  const payload: AutoViewAsPoolCache = {
    fetchedAt: new Date().toISOString(),
    users,
  };

  await prisma.calendarSetting.upsert({
    where: { id: AUTO_VIEW_AS_POOL_CACHE_ID },
    create: { id: AUTO_VIEW_AS_POOL_CACHE_ID, data: JSON.stringify(payload) },
    update: { data: JSON.stringify(payload) },
  });

  return users;
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

    const isViewAs = hasPermission(user, PERMISSIONS.VIEW_AS_USER);

    // Dashboard View As impersonates the full widget (company + per-user sections).
    // This is intentionally separate from admin "Test as User", which never writes this state.
    let viewingAs: ViewAsIdentity | null = null;
    let viewingAsMode: "manual" | "auto" | null = null;
    let viewingAsAutoRotatesAt: string | null = null;
    let autoRotateEnabled: boolean | null = null;
    const canToggleAutoRotate = isViewAs && user.role === "SUPER_ADMIN";
    let autoRotateNonce = 0;
    if (isViewAs) {
      if (user.role === "SUPER_ADMIN") {
        autoRotateEnabled = true;
        const autoRotateRow = await prisma.calendarSetting.findUnique({
          where: { id: `${AUTO_VIEW_AS_ENABLED_PREFIX}${user.sub}` },
        });
        if (autoRotateRow?.data) {
          try {
            const parsed = JSON.parse(autoRotateRow.data) as AutoViewAsEnabledData;
            if (typeof parsed.enabled === "boolean") {
              autoRotateEnabled = parsed.enabled;
            }
          } catch {
            /* ignore invalid auto-rotate setting payload */
          }
        }

        const autoRotateNonceRow = await prisma.calendarSetting.findUnique({
          where: { id: `${AUTO_VIEW_AS_NONCE_PREFIX}${user.sub}` },
        });
        if (autoRotateNonceRow?.data) {
          try {
            const parsed = JSON.parse(autoRotateNonceRow.data) as AutoViewAsNonceData;
            if (Number.isFinite(parsed.nonce)) {
              autoRotateNonce = parsed.nonce;
            }
          } catch {
            /* ignore invalid auto-rotate nonce payload */
          }
        }
      }

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
            viewingAsMode = "manual";
          }
        } catch {
          /* ignore invalid view-as payload */
        }
      }

      if (!viewingAs && user.role === "SUPER_ADMIN" && autoRotateEnabled !== false) {
        const nowMs = Date.now();
        const candidates = await loadAutoViewAsPool();
        const eligibleCandidates = candidates.filter((c) =>
          hasVisiblePanelForRoles(config.panels, c.roles ?? []),
        );
        const autoSeed = `${user.sub}:${autoRotateNonce}`;
        const autoIdentity = pickHourlyRotatingIdentity(eligibleCandidates, autoSeed, nowMs);
        if (autoIdentity) {
          viewingAs = autoIdentity;
          viewingAsMode = "auto";
          viewingAsAutoRotatesAt = nextHourBoundaryIso(nowMs);
        }
      }
    }

    const hasViewAsIdentity = Boolean(viewingAs?.name || viewingAs?.email);
    const effectiveRoles = hasViewAsIdentity
      ? (viewingAs?.roles ?? [])
      : (user.logtoRoles ?? []);
    const normalizedEffectiveRoles = new Set(effectiveRoles.map(normalizeRoleToken));

    const enabledPanels = config.panels
      .filter((p) => {
        if (!p.enabled || !p.reportId) return false;
        const hasReportFilters = p.reportFilters?.some((f) => f.replaceWithUser);
        return hasReportFilters || !!p.filterColumn;
      })
      .sort((a, b) => a.order - b.order)
      .filter((p) => {
        if (p.visibleToSuperAdminOnly) {
          return user.role === "SUPER_ADMIN";
        }
        if (!p.visibleToRoles || p.visibleToRoles.length === 0) return true;
        if (hasViewAsIdentity) {
          return p.visibleToRoles.some((r) => normalizedEffectiveRoles.has(normalizeRoleToken(r)));
        }
        if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
        return p.visibleToRoles.some((r) => normalizedEffectiveRoles.has(normalizeRoleToken(r)));
      });

    if (enabledPanels.length === 0) {
      return NextResponse.json({
        panels: [],
        ...(isViewAs ? { canViewAs: true } : {}),
        ...(canToggleAutoRotate ? { canToggleAutoRotate: true } : {}),
        ...(viewingAs ? { viewingAs } : {}),
        ...(viewingAsMode ? { viewingAsMode } : {}),
        ...(viewingAsAutoRotatesAt ? { viewingAsAutoRotatesAt } : {}),
        ...(autoRotateEnabled !== null ? { autoRotateEnabled } : {}),
      });
    }

    // Use impersonated identity for dashboard view-as, otherwise real user
    const userName = viewingAs?.name || user.name || "";
    const userEmail = viewingAs?.email || user.email || "";
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
      ...(isViewAs ? { canViewAs: true } : {}),
      ...(canToggleAutoRotate ? { canToggleAutoRotate: true } : {}),
      ...(viewingAs ? { viewingAs } : {}),
      ...(viewingAsMode ? { viewingAsMode } : {}),
      ...(viewingAsAutoRotatesAt ? { viewingAsAutoRotatesAt } : {}),
      ...(autoRotateEnabled !== null ? { autoRotateEnabled } : {}),
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
