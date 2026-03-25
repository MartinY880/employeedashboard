// ProConnect — Unified Reports Dashboard Widget
// Combines company-level SF reports and per-user pipeline reports
// into a single widget: Company #1 → Individual #1-3 → Company #2
// Flexible — gracefully skips any section that has no data.

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Activity,
  TrendingUp,
  Maximize2,
  Loader2,
  X,
  Eye,
  ChevronDown,
  UserSearch,
  Check,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart } from "@/components/charts/PieChart";
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
  displayMode: "table" | "stat" | "chart";
  highlightTopN: number;
  columns?: { name: string; label: string }[];
  rows?: { cells: { label: string; value: string }[] }[];
  totalRows?: number;
  maxRows?: number;
  statValue?: string;
  statLabel?: string;
  fetchedAt?: string;
  chartData?: { label: string; value: number }[];
  grandTotals?: { name: string; label: string; value: string }[];
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
  const [canViewAs, setCanViewAs] = useState(false);
  const [clearingViewAs, setClearingViewAs] = useState(false);

  // Admin View-As controls
  const [viewAsOpen, setViewAsOpen] = useState(false);
  const [viewAsName, setViewAsName] = useState("");
  const [viewAsRoles, setViewAsRoles] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string; normalized: string }[]>([]);
  const [applyingViewAs, setApplyingViewAs] = useState(false);

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
        if (data.canViewAs) setCanViewAs(true);
      }
    } catch {
      /* ignore — individual setters handle partial failures */
    } finally {
      setLoading(false);
    }
  }, []);

  // Load available roles when admin opens the view-as panel
  useEffect(() => {
    if (!canViewAs) return;
    fetch("/api/active-pipeline/roles")
      .then((r) => (r.ok ? r.json() : { roles: [] }))
      .then((data) => setAvailableRoles(data.roles ?? []))
      .catch(() => {});
  }, [canViewAs]);

  // Pre-fill view-as form when existing impersonation is loaded
  useEffect(() => {
    if (viewingAs) {
      setViewAsName(viewingAs.name || viewingAs.email || "");
      setViewAsRoles(viewingAs.roles ?? []);
    }
  }, [viewingAs]);

  const applyViewAs = useCallback(async () => {
    if (!viewAsName.trim()) return;
    setApplyingViewAs(true);
    try {
      await fetch("/api/active-pipeline/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: viewAsName.trim(), email: "", roles: viewAsRoles }),
      });
      setViewAsOpen(false);
      await fetchData();
    } catch { /* ignore */ }
    finally { setApplyingViewAs(false); }
  }, [viewAsName, viewAsRoles, fetchData]);

  const clearViewAs = useCallback(async () => {
    setClearingViewAs(true);
    try {
      await fetch("/api/active-pipeline/view-as", { method: "DELETE" });
      setViewingAs(null);
      setViewAsName("");
      setViewAsRoles([]);
      await fetchData();
    } catch {
      /* ignore */
    } finally {
      setClearingViewAs(false);
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

  if (orderedPanels.length === 0) return null;

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
        {canViewAs && orderedPanels.length > 0 && (
          <ViewAsToolbar
            viewingAs={viewingAs}
            open={viewAsOpen}
            onToggle={() => setViewAsOpen((v) => !v)}
            name={viewAsName}
            onNameChange={setViewAsName}
            roles={viewAsRoles}
            onRolesChange={setViewAsRoles}
            availableRoles={availableRoles}
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

// ─── Admin View-As Toolbar ──────────────────────────────

function ViewAsToolbar({
  viewingAs,
  open,
  onToggle,
  name,
  onNameChange,
  roles,
  onRolesChange,
  availableRoles,
  onApply,
  onClear,
  applying,
  clearing,
}: {
  viewingAs: { name: string; email: string; roles?: string[] } | null;
  open: boolean;
  onToggle: () => void;
  name: string;
  onNameChange: (v: string) => void;
  roles: string[];
  onRolesChange: (v: string[]) => void;
  availableRoles: { id: string; name: string; normalized: string }[];
  onApply: () => void;
  onClear: () => void;
  applying: boolean;
  clearing: boolean;
}) {
  const hasActive = !!viewingAs;

  return (
    <div className={`border-b ${hasActive ? "border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10" : "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30"}`}>
      {/* Collapsed bar */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <UserSearch className={`w-3.5 h-3.5 shrink-0 ${hasActive ? "text-orange-600" : "text-gray-400"}`} />
          {hasActive ? (
            <span className="text-xs font-medium text-orange-800 dark:text-orange-300 truncate">
              Viewing as: <span className="font-bold">{viewingAs.name || viewingAs.email}</span>
              {viewingAs.roles && viewingAs.roles.length > 0 && (
                <span className="ml-1 text-orange-600 dark:text-orange-400">
                  ({viewingAs.roles.map(r => availableRoles.find(ar => ar.normalized === r)?.name || r).join(", ")})
                </span>
              )}
            </span>
          ) : (
            <span className="text-xs text-gray-500">View As...</span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

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
            </div>

            {/* Role selector */}
            {availableRoles.length > 0 && (
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Role
                </label>
                <RoleDropdown
                  roles={roles}
                  availableRoles={availableRoles}
                  onChange={onRolesChange}
                />
              </div>
            )}
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
        </div>
      )}
    </div>
  );
}

// ─── Role Dropdown (multi-select) ───────────────────────

function RoleDropdown({
  roles,
  availableRoles,
  onChange,
}: {
  roles: string[];
  availableRoles: { id: string; name: string; normalized: string }[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (normalized: string) => {
    onChange(
      roles.includes(normalized)
        ? roles.filter((r) => r !== normalized)
        : [...roles, normalized],
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
      >
        <span className="truncate text-gray-700 dark:text-gray-300">
          {roles.length === 0
            ? "All roles (admin default)"
            : roles.map(r => availableRoles.find(ar => ar.normalized === r)?.name || r).join(", ")}
        </span>
        <ChevronDown className={`w-3 h-3 ml-1 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1">
          {availableRoles.map((r) => {
            const selected = roles.includes(r.normalized);
            return (
              <button
                key={r.id}
                onClick={() => toggle(r.normalized)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-800 ${selected ? "text-orange-700 dark:text-orange-300 font-medium" : "text-gray-700 dark:text-gray-300"}`}
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${selected ? "bg-orange-500 border-orange-500" : "border-gray-300 dark:border-gray-600"}`}>
                  {selected && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                {r.name}
              </button>
            );
          })}
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
