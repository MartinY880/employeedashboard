// ProConnect — Unified Reports Dashboard Widget
// Combines company-level SF reports and per-user pipeline reports
// into a single widget: Company #1 → Individual #1-3 → Company #2
// Flexible — gracefully skips any section that has no data.

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Activity,
  TrendingUp,
  Maximize2,
  Loader2,
  X,
  Eye,
  RefreshCw,
  ChevronDown,
  UserSearch,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Unified panel type covering both company + individual ──

interface UnifiedPanel {
  id: string;
  title: string;
  source: "company" | "individual";
  displayMode: "table" | "stat" | "chart" | "bar";
  highlightTopN: number;
  columns?: { name: string; label: string }[];
  rows?: { cells: { label: string; value: string }[] }[];
  totalRows?: number;
  maxRows?: number;
  statValue?: string;
  statLabel?: string;
  fetchedAt?: string;
  chartData?: { label: string; value: number }[];
  barUnits?: "currency" | "number" | "percent";
  barLayout?: "vertical" | "horizontal";
  grandTotals?: { name: string; label: string; value: string }[];
}

interface ViewAsSuggestion {
  name: string;
  email: string;
  jobTitle: string;
  logtoRoles: string[];
}

// ─── Main Widget ────────────────────────────────────────

export function UnifiedReportsWidget() {
  const [companyPanels, setCompanyPanels] = useState<UnifiedPanel[]>([]);
  const [individualPanels, setIndividualPanels] = useState<UnifiedPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewAllPanel, setViewAllPanel] = useState<{
    id: string;
    source: "company" | "individual";
  } | null>(null);
  const [viewingAs, setViewingAs] = useState<{
    name: string;
    email: string;
    roles?: string[];
  } | null>(null);
  const [viewingAsMode, setViewingAsMode] = useState<"manual" | "auto" | null>(null);
  const [viewingAsAutoRotatesAt, setViewingAsAutoRotatesAt] = useState<string | null>(null);
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(true);
  const [canToggleAutoRotate, setCanToggleAutoRotate] = useState(false);
  const [canViewAs, setCanViewAs] = useState(false);
  const [clearingViewAs, setClearingViewAs] = useState(false);

  // Admin View-As controls
  const [viewAsOpen, setViewAsOpen] = useState(false);
  const [viewAsName, setViewAsName] = useState("");
  const [viewAsEmail, setViewAsEmail] = useState("");
  const [viewAsSuggestions, setViewAsSuggestions] = useState<ViewAsSuggestion[]>([]);
  const [searchingViewAs, setSearchingViewAs] = useState(false);
  const [applyingViewAs, setApplyingViewAs] = useState(false);
  const [togglingAutoRotate, setTogglingAutoRotate] = useState(false);
  const [refreshingAutoUser, setRefreshingAutoUser] = useState(false);
  const [viewAsError, setViewAsError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [companyRes, pipelineRes] = await Promise.allSettled([
        fetch("/api/salesforce/report-panels", { cache: "no-store" }),
        fetch("/api/active-pipeline", { cache: "no-store" }),
      ]);

      if (companyRes.status === "fulfilled" && companyRes.value.ok) {
        const data = await companyRes.value.json();
        setCompanyPanels(
          (data.panels ?? []).map(
            (p: Record<string, unknown>) =>
              ({ ...p, source: "company" }) as UnifiedPanel,
          ),
        );
      }

      if (pipelineRes.status === "fulfilled" && pipelineRes.value.ok) {
        const data = await pipelineRes.value.json();
        setIndividualPanels(
          (data.panels ?? []).map(
            (p: Record<string, unknown>) =>
              ({ ...p, source: "individual" }) as UnifiedPanel,
          ),
        );
        setViewingAs(data.viewingAs ?? null);
        setViewingAsMode(data.viewingAsMode === "auto" || data.viewingAsMode === "manual" ? data.viewingAsMode : null);
        setViewingAsAutoRotatesAt(typeof data.viewingAsAutoRotatesAt === "string" ? data.viewingAsAutoRotatesAt : null);
        if (typeof data.autoRotateEnabled === "boolean") {
          setAutoRotateEnabled(data.autoRotateEnabled);
        }
        setCanToggleAutoRotate(Boolean(data.canToggleAutoRotate));
        setCanViewAs(Boolean(data.canViewAs));
      }
    } catch {
      /* ignore — individual setters handle partial failures */
    } finally {
      setLoading(false);
    }
  }, []);

  // Pre-fill view-as form when existing impersonation is loaded
  useEffect(() => {
    if (viewingAs) {
      setViewAsName(viewingAs.name || viewingAs.email || "");
      setViewAsEmail(viewingAs.email || "");
    }
  }, [viewingAs]);

  useEffect(() => {
    if (!canViewAs || !viewAsOpen) {
      setViewAsSuggestions([]);
      setSearchingViewAs(false);
      return;
    }

    const query = viewAsName.trim();
    if (query.length < 2) {
      setViewAsSuggestions([]);
      setSearchingViewAs(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchingViewAs(true);
      try {
        const res = await fetch(`/api/active-pipeline/view-as/search?query=${encodeURIComponent(query)}&limit=8`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          setViewAsSuggestions([]);
          return;
        }
        const data = await res.json();
        setViewAsSuggestions(Array.isArray(data.users) ? data.users : []);
      } catch {
        setViewAsSuggestions([]);
      } finally {
        setSearchingViewAs(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [canViewAs, viewAsOpen, viewAsName]);

  const applyViewAs = useCallback(async () => {
    if (!viewAsName.trim()) return;
    setApplyingViewAs(true);
    setViewAsError("");
    try {
      const res = await fetch("/api/active-pipeline/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: viewAsName.trim(), email: viewAsEmail.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Failed to apply View As");
      }
      setViewAsOpen(false);
      setViewAsSuggestions([]);
      await fetchData();
    } catch (err) {
      setViewAsError(err instanceof Error ? err.message : "Failed to apply View As");
    }
    finally { setApplyingViewAs(false); }
  }, [viewAsName, viewAsEmail, fetchData]);

  const clearViewAs = useCallback(async () => {
    setClearingViewAs(true);
    try {
      await fetch("/api/active-pipeline/view-as", { method: "DELETE" });
      setViewingAs(null);
      setViewingAsMode(null);
      setViewingAsAutoRotatesAt(null);
      setViewAsName("");
      setViewAsEmail("");
      setViewAsSuggestions([]);
      setViewAsError("");
      await fetchData();
    } catch {
      /* ignore */
    } finally {
      setClearingViewAs(false);
    }
  }, [fetchData]);

  const setAutoRotate = useCallback(async (enabled: boolean) => {
    setTogglingAutoRotate(true);
    setViewAsError("");
    try {
      const res = await fetch("/api/active-pipeline/view-as", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Failed to update auto rotation setting");
      }
      setAutoRotateEnabled(enabled);
      await fetchData();
    } catch (err) {
      setViewAsError(err instanceof Error ? err.message : "Failed to update auto rotation setting");
    } finally {
      setTogglingAutoRotate(false);
    }
  }, [fetchData]);

  const refreshAutoUser = useCallback(async () => {
    setRefreshingAutoUser(true);
    setViewAsError("");
    try {
      const res = await fetch("/api/active-pipeline/view-as", { method: "PUT" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Failed to refresh auto-selected user");
      }
      await fetchData();
    } catch (err) {
      setViewAsError(err instanceof Error ? err.message : "Failed to refresh auto-selected user");
    } finally {
      setRefreshingAutoUser(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => fetchData(), 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchData]);

  // ─── Build interleaved order ──────────────────────────
  // Company[0] → All individual → Company[1+]
  const orderedPanels: UnifiedPanel[] = [];
  if (companyPanels.length > 0) orderedPanels.push(companyPanels[0]);
  orderedPanels.push(...individualPanels);
  if (companyPanels.length > 1) orderedPanels.push(...companyPanels.slice(1));

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-8 w-full rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (orderedPanels.length === 0 && !canViewAs) return null;

  // Group stat panels into one stacked column; each non-stat panel is its own column
  type ColumnGroup = { type: "single"; panel: UnifiedPanel } | { type: "stat-stack"; panels: UnifiedPanel[] };
  const columns: ColumnGroup[] = [];
  const statPanels = orderedPanels.filter((p) => p.displayMode === "stat");
  let statGroupInserted = false;
  for (const panel of orderedPanels) {
    if (panel.displayMode === "stat") {
      if (!statGroupInserted && statPanels.length > 1) {
        columns.push({ type: "stat-stack", panels: statPanels });
        statGroupInserted = true;
      } else if (statPanels.length === 1) {
        columns.push({ type: "single", panel });
      }
      // skip additional stat panels — already grouped
    } else {
      columns.push({ type: "single", panel });
    }
  }
  const colCount = columns.length;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
      >
        {/* Admin View-As Toolbar */}
        {canViewAs && (
          <ViewAsToolbar
            viewingAs={viewingAs}
            mode={viewingAsMode}
            autoRotatesAt={viewingAsAutoRotatesAt}
            autoRotateEnabled={autoRotateEnabled}
            canToggleAutoRotate={canToggleAutoRotate}
            autoRotateBusy={togglingAutoRotate}
            refreshingAutoUser={refreshingAutoUser}
            open={viewAsOpen}
            onToggle={() => setViewAsOpen((v) => !v)}
            onToggleAutoRotate={setAutoRotate}
            onRefreshAutoUser={refreshAutoUser}
            name={viewAsName}
            onNameChange={(value) => {
              setViewAsName(value);
              setViewAsEmail("");
            }}
            suggestions={viewAsSuggestions}
            searching={searchingViewAs}
            onPickSuggestion={(entry) => {
              setViewAsName(entry.name);
              setViewAsEmail(entry.email);
              setViewAsSuggestions([]);
              setViewAsError("");
            }}
            error={viewAsError}
            onApply={applyViewAs}
            onClear={clearViewAs}
            applying={applyingViewAs}
            clearing={clearingViewAs}
          />
        )}
        <style>{`
          @media (min-width: 768px) {
            #unified-reports-grid {
              grid-template-columns: repeat(${Math.min(colCount, 2)}, 1fr) !important;
            }
          }
          @media (min-width: 1280px) {
            #unified-reports-grid {
              grid-template-columns: repeat(${colCount}, 1fr) !important;
            }
          }
        `}</style>
        <div id="unified-reports-grid" className="grid grid-cols-1 items-start">
          {columns.map((col, idx) => (
            <div
              key={col.type === "single" ? `${col.panel.source}-${col.panel.id}` : "stat-stack"}
              className={`min-w-0 ${
                idx > 0
                  ? "border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800"
                  : ""
              }`}
            >
              {col.type === "stat-stack" ? (
                <div className="flex flex-col">
                  {col.panels.map((panel, si) => (
                    <div
                      key={`${panel.source}-${panel.id}`}
                      className={si > 0 ? "border-t border-gray-100 dark:border-gray-800" : ""}
                    >
                      <StatSection panel={panel} />
                    </div>
                  ))}
                </div>
              ) : col.panel.displayMode === "stat" ? (
                <StatSection panel={col.panel} />
              ) : col.panel.displayMode === "chart" ? (
                <ChartSection panel={col.panel} />
              ) : col.panel.displayMode === "bar" ? (
                <BarSection
                  panel={col.panel}
                  onViewAll={() =>
                    setViewAllPanel({ id: col.panel.id, source: col.panel.source })
                  }
                />
              ) : (
                <TableSection
                  panel={col.panel}
                  onViewAll={() =>
                    setViewAllPanel({ id: col.panel.id, source: col.panel.source })
                  }
                />
              )}
            </div>
          ))}
        </div>
      </motion.div>
      <ViewAllModal
        panel={viewAllPanel}
        onClose={() => setViewAllPanel(null)}
      />
    </>
  );
}

function BarSection({
  panel,
  onViewAll,
}: {
  panel: UnifiedPanel;
  onViewAll?: () => void;
}) {
  const isCompany = panel.source === "company";
  const Icon = isCompany ? BarChart3 : Activity;
  const accentBorder = isCompany ? "border-t-brand-blue" : "border-t-emerald-500";
  const iconColor = isCompany ? "text-brand-blue" : "text-emerald-600";
  const titleColor = isCompany
    ? "text-brand-blue"
    : "text-emerald-700 dark:text-emerald-400";
  const isTruncated =
    panel.totalRows != null && panel.maxRows != null && panel.totalRows > panel.maxRows;
  const viewAllColor = isCompany
    ? "text-brand-blue hover:text-brand-blue/80"
    : "text-emerald-600 hover:text-emerald-500";
  const viewActionLabel = isCompany ? "View More" : "View All";

  return (
    <div className="flex flex-col">
      <div
        className={`px-3 py-2 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] ${accentBorder} flex items-center justify-between shrink-0`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />
          <h3 className={`text-xs font-bold ${titleColor} tracking-wide uppercase truncate`}>
            {panel.title || "Report"}
          </h3>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {panel.fetchedAt && (
            <span className="text-[10px] text-brand-grey hidden sm:inline">
              Updated {formatRelativeTime(panel.fetchedAt)}
            </span>
          )}
          {isTruncated && onViewAll && (
            <button
              onClick={onViewAll}
              className={`inline-flex items-center gap-1 text-[11px] font-medium ${viewAllColor} transition-colors`}
            >
              <Maximize2 className="w-3 h-3" />
              {viewActionLabel}
            </button>
          )}
        </div>
      </div>
      <div className="w-full" style={{ height: 166 }}>
        {panel.chartData && panel.chartData.length > 0 ? (
          <BarChart data={panel.chartData} units={panel.barUnits} layout={panel.barLayout} className="w-full h-full" />
        ) : (
          <span className="text-sm text-brand-grey py-8">No chart data available</span>
        )}
      </div>
    </div>
  );
}

// ─── Admin View-As Toolbar ──────────────────────────────

function ViewAsToolbar({
  viewingAs,
  mode,
  autoRotatesAt,
  autoRotateEnabled,
  canToggleAutoRotate,
  autoRotateBusy,
  refreshingAutoUser,
  open,
  onToggle,
  onToggleAutoRotate,
  onRefreshAutoUser,
  name,
  onNameChange,
  suggestions,
  searching,
  onPickSuggestion,
  error,
  onApply,
  onClear,
  applying,
  clearing,
}: {
  viewingAs: { name: string; email: string; roles?: string[] } | null;
  mode: "manual" | "auto" | null;
  autoRotatesAt: string | null;
  autoRotateEnabled: boolean;
  canToggleAutoRotate: boolean;
  autoRotateBusy: boolean;
  refreshingAutoUser: boolean;
  open: boolean;
  onToggle: () => void;
  onToggleAutoRotate: (enabled: boolean) => void;
  onRefreshAutoUser: () => void;
  name: string;
  onNameChange: (v: string) => void;
  suggestions: ViewAsSuggestion[];
  searching: boolean;
  onPickSuggestion: (entry: ViewAsSuggestion) => void;
  error: string;
  onApply: () => void;
  onClear: () => void;
  applying: boolean;
  clearing: boolean;
}) {
  const hasActive = !!viewingAs;
  const isAutoMode = mode === "auto";

  return (
    <div className={`border-b ${hasActive ? "border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10" : "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30"}`}>
      {/* Collapsed bar */}
      <div className="w-full px-3 py-2 flex items-center gap-2">
        <button
          onClick={onToggle}
          className="min-w-0 flex-1 flex items-center gap-2 text-left"
        >
          <UserSearch className={`w-3.5 h-3.5 shrink-0 ${hasActive ? "text-orange-600" : "text-gray-400"}`} />
          {hasActive ? (
            <span className="text-xs font-medium text-orange-800 dark:text-orange-300 truncate">
              {isAutoMode ? "Auto preview as:" : "Viewing as:"} <span className="font-bold">{viewingAs.name || viewingAs.email}</span>
            </span>
          ) : (
            <span className="text-xs text-gray-500">View As...</span>
          )}
        </button>

        {isAutoMode && (
          <button
            onClick={onRefreshAutoUser}
            disabled={refreshingAutoUser}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-[11px] font-medium text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30 disabled:opacity-60 transition-colors shrink-0"
          >
            {refreshingAutoUser ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh User
          </button>
        )}

        {canToggleAutoRotate && (
          <button
            type="button"
            role="switch"
            aria-checked={autoRotateEnabled}
            onClick={() => onToggleAutoRotate(!autoRotateEnabled)}
            disabled={autoRotateBusy}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoRotateEnabled ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"} ${autoRotateBusy ? "opacity-60" : ""} shrink-0`}
            title={autoRotateEnabled ? "Auto rotate is on" : "Auto rotate is off"}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoRotateEnabled ? "translate-x-4" : "translate-x-0.5"}`}
            />
          </button>
        )}

        <button
          onClick={onToggle}
          className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
          aria-label={open ? "Collapse View As" : "Expand View As"}
        >
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="px-3 pb-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Name input */}
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Person Name
              </label>
              <input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="John Doe"
                onKeyDown={(e) => { if (e.key === "Enter") onApply(); }}
                className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              {(searching || suggestions.length > 0) && (
                <div className="mt-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                  {searching ? (
                    <div className="px-2.5 py-2 text-[11px] text-gray-500">Searching directory...</div>
                  ) : (
                    <div className="max-h-52 overflow-y-auto">
                      {suggestions.map((entry) => (
                        <button
                          key={`${entry.name}|${entry.email}`}
                          type="button"
                          onClick={() => onPickSuggestion(entry)}
                          className="w-full text-left px-2.5 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                        >
                          <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                            {entry.name}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {entry.email || "No email"}
                            {entry.jobTitle ? ` • ${entry.jobTitle}` : ""}
                          </div>
                          <div className="text-[10px] text-orange-700 dark:text-orange-300 mt-0.5">
                            Role: {entry.logtoRoles.length > 0 ? entry.logtoRoles.join(", ") : "No Logto roles"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onApply}
              disabled={applying || !name.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
            >
              {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
              Apply
            </button>
            {isAutoMode && (
              <button
                onClick={onRefreshAutoUser}
                disabled={refreshingAutoUser}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-xs font-medium text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30 disabled:opacity-60 transition-colors"
              >
                {refreshingAutoUser ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Refresh User
              </button>
            )}
            {hasActive && (
              <button
                onClick={onClear}
                disabled={clearing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                Clear
              </button>
            )}
          </div>
          {isAutoMode && (
            <div className="text-[11px] text-orange-700 dark:text-orange-300">
              Auto preview mode: rotates hourly{autoRotatesAt ? ` (next ${formatRelativeTime(autoRotatesAt)})` : ""}.
            </div>
          )}
          {error && (
            <div className="text-[11px] text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stat Section ───────────────────────────────────────

function StatSection({ panel }: { panel: UnifiedPanel }) {
  const isCompany = panel.source === "company";
  const accentBorder = isCompany ? "border-t-brand-blue" : "border-t-emerald-500";
  return (
    <div className={`border-t-[3px] ${accentBorder}`}>
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <TrendingUp
            className={`w-3.5 h-3.5 shrink-0 ${isCompany ? "text-brand-blue" : "text-emerald-500"}`}
          />
          <h3 className="text-[11px] font-bold text-brand-grey tracking-wide uppercase truncate">
            {panel.statLabel || panel.title}
          </h3>
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {panel.statValue ?? "—"}
        </div>
        {panel.fetchedAt && (
          <span className="text-[10px] text-brand-grey mt-1 block">
            Updated {formatRelativeTime(panel.fetchedAt)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Chart Section (Pie/Donut) ──────────────────────────

function ChartSection({ panel }: { panel: UnifiedPanel }) {
  const isCompany = panel.source === "company";
  const Icon = isCompany ? BarChart3 : Activity;
  const accentBorder = isCompany ? "border-t-brand-blue" : "border-t-emerald-500";
  const iconColor = isCompany ? "text-brand-blue" : "text-emerald-600";
  const titleColor = isCompany
    ? "text-brand-blue"
    : "text-emerald-700 dark:text-emerald-400";

  return (
    <>
      <div
        className={`px-3 py-2 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] ${accentBorder} flex items-center justify-between`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />
          <h3
            className={`text-xs font-bold ${titleColor} tracking-wide uppercase truncate`}
          >
            {panel.title || "Report"}
          </h3>
        </div>
        {panel.fetchedAt && (
          <span className="text-[10px] text-brand-grey">
            Updated {formatRelativeTime(panel.fetchedAt)}
          </span>
        )}
      </div>
      <div className="p-2 flex justify-center">
        {panel.chartData && panel.chartData.length > 0 ? (
          <PieChart data={panel.chartData} size={160} />
        ) : (
          <span className="text-sm text-brand-grey py-8">
            No chart data available
          </span>
        )}
      </div>
    </>
  );
}

// ─── Table Section ──────────────────────────────────────

function TableSection({
  panel,
  onViewAll,
}: {
  panel: UnifiedPanel;
  onViewAll?: () => void;
}) {
  const { title, columns, rows, totalRows, maxRows, fetchedAt, highlightTopN, grandTotals } =
    panel;
  const isTruncated =
    totalRows != null && maxRows != null && totalRows > maxRows;
  const isCompany = panel.source === "company";

  const Icon = isCompany ? BarChart3 : Activity;
  const accentBorder = isCompany
    ? "border-t-brand-blue"
    : "border-t-emerald-500";
  const iconColor = isCompany ? "text-brand-blue" : "text-emerald-600";
  const titleColor = isCompany
    ? "text-brand-blue"
    : "text-emerald-700 dark:text-emerald-400";
  const viewAllColor = isCompany
    ? "text-brand-blue hover:text-brand-blue/80"
    : "text-emerald-600 hover:text-emerald-500";
  const highlightBg = isCompany
    ? "bg-amber-50/30 dark:bg-amber-900/10"
    : "bg-emerald-50/30 dark:bg-emerald-900/10";
  const viewActionLabel = isCompany ? "View More" : "View All";

  return (
    <>
      <div
        className={`px-3 py-2 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] ${accentBorder} flex items-center justify-between`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />
          <h3
            className={`text-xs font-bold ${titleColor} tracking-wide uppercase truncate`}
          >
            {title || "Report"}
          </h3>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {fetchedAt && (
            <span className="text-[10px] text-brand-grey hidden sm:inline">
              Updated {formatRelativeTime(fetchedAt)}
            </span>
          )}
          {isTruncated && onViewAll && (
            <button
              onClick={onViewAll}
              className={`inline-flex items-center gap-1 text-[11px] font-medium ${viewAllColor} transition-colors`}
            >
              <Maximize2 className="w-3 h-3" />
              {viewActionLabel}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-brand-grey uppercase tracking-wider w-8">
                #
              </th>
              {columns?.map((col) => (
                <th
                  key={col.name}
                  className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-brand-grey uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows && rows.length > 0 ? (
              rows.map((row, i) => (
                <tr
                  key={i}
                  className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 ${
                    highlightTopN > 0 && i < highlightTopN ? highlightBg : ""
                  }`}
                >
                  <td className="px-2.5 py-1.5 text-xs font-bold text-brand-grey">
                    {highlightTopN > 0 && i < highlightTopN ? (
                      <span
                        className={`inline-flex h-4.5 w-4.5 items-center justify-center rounded-full text-[9px] font-bold text-white ${rankBadgeColor(i, isCompany)}`}
                      >
                        {i + 1}
                      </span>
                    ) : (
                      i + 1
                    )}
                  </td>
                  {row.cells.map((cell, j) => (
                    <td
                      key={j}
                      className="px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap"
                    >
                      {cell.label || cell.value || "—"}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={(columns?.length ?? 0) + 1}
                  className="px-2.5 py-4 text-center text-brand-grey text-xs"
                >
                  No data available
                </td>
              </tr>
            )}
          </tbody>
          {!isCompany && grandTotals && grandTotals.length > 0 && columns && columns.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 dark:bg-gray-800 font-semibold border-t-2 border-gray-300 dark:border-gray-600">
                <td className="px-2.5 py-1.5 text-xs text-brand-grey"></td>
                {columns.map((col, colIdx) => {
                  // First column (grouping) shows "Total"
                  if (colIdx === 0) {
                    return (
                      <td key={col.name} className="px-2.5 py-1.5 text-xs font-bold text-gray-900 dark:text-gray-100 uppercase">
                        Total
                      </td>
                    );
                  }
                  // Match column to a grand total by name
                  const gt = grandTotals.find((g) => g.name === col.name);
                  return (
                    <td key={col.name} className="px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {gt?.label || ""}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

// ─── View All Modal ─────────────────────────────────────

interface FullPanelData {
  title: string;
  columns: { name: string; label: string }[];
  rows: { cells: { label: string; value: string }[] }[];
  totalRows: number;
  highlightTopN: number;
  fetchedAt?: string;
}

function ViewAllModal({
  panel,
  onClose,
}: {
  panel: { id: string; source: "company" | "individual" } | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<FullPanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!panel) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Route to the correct API based on source
    const apiBase =
      panel.source === "company"
        ? "/api/salesforce/report-panels"
        : "/api/active-pipeline";

    fetch(`${apiBase}/${encodeURIComponent(panel.id)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json() as Promise<FullPanelData>;
      })
      .then((json) => setData(json))
      .catch(() => setError("Failed to load full report data"))
      .finally(() => setLoading(false));
  }, [panel]);

  const isCompany = panel?.source === "company";
  const Icon = isCompany ? BarChart3 : Activity;
  const iconColor = isCompany ? "text-brand-blue" : "text-emerald-600";

  return (
    <Dialog
      open={!!panel}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${iconColor}`} />
            {data?.title || "Report Data"}
            {data && (
              <span className="text-sm font-normal text-brand-grey ml-2">
                ({data.totalRows} {data.totalRows === 1 ? "row" : "rows"})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-auto flex-1 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className={`w-6 h-6 animate-spin ${iconColor}`} />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-16 text-sm text-red-500">
              {error}
            </div>
          )}

          {data && !loading && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 dark:bg-gray-800/80">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-brand-grey uppercase tracking-wider w-10">
                    #
                  </th>
                  {data.columns.map((col) => (
                    <th
                      key={col.name}
                      className="px-3 py-2 text-left text-[11px] font-semibold text-brand-grey uppercase tracking-wider"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.rows.map((row, i) => {
                  const highlightBg = isCompany
                    ? "bg-amber-50/30 dark:bg-amber-900/10"
                    : "bg-emerald-50/30 dark:bg-emerald-900/10";
                  return (
                    <tr
                      key={i}
                      className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 ${
                        data.highlightTopN > 0 && i < data.highlightTopN
                          ? highlightBg
                          : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-xs font-bold text-brand-grey">
                        {data.highlightTopN > 0 && i < data.highlightTopN ? (
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${rankBadgeColor(i, !!isCompany)}`}
                          >
                            {i + 1}
                          </span>
                        ) : (
                          i + 1
                        )}
                      </td>
                      {row.cells.map((cell, j) => (
                        <td
                          key={j}
                          className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap"
                        >
                          {cell.label || cell.value || "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {data?.fetchedAt && (
          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-brand-grey shrink-0">
            Updated {formatRelativeTime(data.fetchedAt)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ────────────────────────────────────────────

function rankBadgeColor(index: number, isCompany: boolean): string {
  if (isCompany) {
    switch (index) {
      case 0:
        return "bg-amber-400";
      case 1:
        return "bg-gray-400";
      case 2:
        return "bg-amber-600";
      default:
        return "bg-brand-blue/70";
    }
  }
  switch (index) {
    case 0:
      return "bg-emerald-500";
    case 1:
      return "bg-emerald-400";
    case 2:
      return "bg-emerald-600";
    default:
      return "bg-emerald-500/70";
  }
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
