// ProConnect — Admin Per User Reports Settings
// Configure per-user filtered Salesforce report panels for the dashboard.

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
  Pencil,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Table2,
  TrendingUp,
  Filter,
  UserSearch,
  Play,
  PieChart as PieChartIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PipelinePanel } from "@/types/active-pipeline";

interface ColumnInfo {
  name: string;
  label: string;
  dataType?: string;
}

interface AudienceRoleMapping {
  id: string;
  jobTitle: string;
  logtoRoleName: string;
  normalizedRole: string;
}

interface AudiencePositionCount {
  jobTitle: string;
  count: number;
}

type AssignedCounts = Record<string, number>;

function normalizeTitleToken(title: string): string {
  return title.trim().toLowerCase();
}

function extractReportId(input: string): string | null {
  const trimmed = input.trim();
  if (/^00O[A-Za-z0-9]{12,15}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/Report\/([A-Za-z0-9]{15,18})/i);
  return match?.[1] ?? null;
}

const DEFAULT_SECTION: Omit<PipelinePanel, "id" | "order"> = {
  enabled: true,
  title: "New Per-User Report",
  displayMode: "table",
  reportUrl: "",
  reportId: "",
  reportName: "",
  visibleColumns: [],
  columnLabels: {},
  maxRows: 25,
  refreshMinutes: 15,
  highlightTopN: 0,
  visibleToSuperAdminOnly: false,
  filterColumn: "",
  filterMatchBy: "name",
  filterOperator: "equals",
};

export default function ActivePipelineAdminPage() {
  const [sections, setSections] = useState<PipelinePanel[]>([]);
  const [widgetVisible, setWidgetVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sectionColumns, setSectionColumns] = useState<Record<string, ColumnInfo[]>>({});
  const [describingSection, setDescribingSection] = useState<string | null>(null);
  const [refreshingSection, setRefreshingSection] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string; normalized: string }[]>([]);
  const [audienceMappings, setAudienceMappings] = useState<AudienceRoleMapping[]>([]);
  const [positionCounts, setPositionCounts] = useState<AudiencePositionCount[]>([]);
  const [assignedCounts, setAssignedCounts] = useState<AssignedCounts>({});
  const [audienceLoading, setAudienceLoading] = useState(true);

  // ─── Test-as-user state ───────────────────────────────
  const [testPanelId, setTestPanelId] = useState<string>("");
  const [testValue, setTestValue] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{
    panelTitle: string;
    testValue: string;
    filterColumn: string;
    filterOperator: string;
    filterMatchBy: string;
    reportName: string;
    columns: { name: string; label: string }[];
    rows: { cells: { label: string; value: string }[] }[];
    totalRows: number;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const loadSections = useCallback(async () => {
    try {
      const res = await fetch("/api/active-pipeline?admin=1");
      if (res.ok) {
        const data = await res.json();
        if (data.config?.panels) {
          setSections(data.config.panels);
          setWidgetVisible(data.config.widgetVisible !== false);
          for (const section of data.config.panels as PipelinePanel[]) {
            if (section.reportId) {
              describeForSection(section.id, section.reportUrl || section.reportId, true);
            }
          }
          return;
        }
      }
      setSections([]);
    } catch {
      setSections([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSections();
    fetch("/api/active-pipeline/roles")
      .then((r) => r.ok ? r.json() : { roles: [] })
      .then((data) => setAvailableRoles(data.roles ?? []))
      .catch(() => {});
    fetch("/api/active-pipeline/audience")
      .then((r) => r.ok ? r.json() : { roleMappings: [], positionCounts: [], assignedCounts: {} })
      .then((data) => {
        setAudienceMappings(data.roleMappings ?? []);
        setPositionCounts(data.positionCounts ?? []);
        setAssignedCounts(data.assignedCounts ?? {});
      })
      .catch(() => {})
      .finally(() => setAudienceLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function describeForSection(sectionId: string, url: string, silent = false) {
    if (!url) return;
    if (!silent) setDescribingSection(sectionId);
    try {
      const res = await fetch("/api/active-pipeline/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Describe failed");

      setSectionColumns((prev) => ({ ...prev, [sectionId]: data.columns ?? [] }));

      // Build report filters from describe response
      const describedFilters = (data.filters ?? []).map(
        (f: { column: string; operator: string; value: string }) => ({
          column: f.column,
          operator: f.operator,
          value: f.value,
          replaceWithUser: f.value === "$USER",
          matchBy: "name" as const,
        }),
      );

      if (!silent) {
        setSections((prev) =>
          prev.map((s) => {
            if (s.id !== sectionId) return s;
            const updates: Partial<PipelinePanel> = {
              reportId: data.reportId,
              reportName: data.reportName,
            };
            // Only set filters if not already configured (don't overwrite saved config)
            if (!s.reportFilters || s.reportFilters.length === 0) {
              updates.reportFilters = describedFilters;
              updates.filterLogic = data.filterLogic ?? undefined;
            }
            return { ...s, ...updates };
          }),
        );
        showToast("success", `Found: "${data.reportName}" (${data.columns.length} columns, ${describedFilters.length} filters)`);
      } else {
        // On silent load, populate filters if section has none saved
        setSections((prev) =>
          prev.map((s) => {
            if (s.id !== sectionId) return s;
            if (!s.reportFilters || s.reportFilters.length === 0) {
              return { ...s, reportFilters: describedFilters, filterLogic: data.filterLogic ?? undefined };
            }
            return s;
          }),
        );
      }
    } catch (err) {
      if (!silent) {
        showToast("error", err instanceof Error ? err.message : "Failed to describe report");
      }
    } finally {
      if (!silent) setDescribingSection(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/active-pipeline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetVisible, panels: sections }),
      });
      if (!res.ok) throw new Error("Save failed");
      showToast("success", "Per-user report settings saved!");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleRefresh(sectionId: string) {
    setRefreshingSection(sectionId);
    try {
      const res = await fetch("/api/active-pipeline/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panelId: sectionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      showToast("success", `Refreshed — ${data.totalRows} rows`);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to refresh");
    } finally {
      setRefreshingSection(null);
    }
  }

  async function handleTestRun() {
    if (!testPanelId || !testValue.trim()) return;
    setTestRunning(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await fetch("/api/active-pipeline/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panelId: testPanelId, testValue: testValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test failed");
      setTestResult(data);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestRunning(false);
    }
  }

  function addSection() {
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const newSection: PipelinePanel = {
      ...DEFAULT_SECTION,
      id,
      order: sections.length,
    };
    setSections((prev) => [...prev, newSection]);
    setExpandedId(newSection.id);
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })));
    if (expandedId === id) setExpandedId(null);
  }

  function updateSection(id: string, updates: Partial<PipelinePanel>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }

  function moveSection(id: string, direction: "up" | "down") {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  }

  function toggleColumn(sectionId: string, colName: string) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      visibleColumns: section.visibleColumns.includes(colName)
        ? section.visibleColumns.filter((c) => c !== colName)
        : [...section.visibleColumns, colName],
    });
  }

  function moveColumnInSection(sectionId: string, colName: string, direction: "up" | "down") {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const arr = [...section.visibleColumns];
    const idx = arr.indexOf(colName);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    updateSection(sectionId, { visibleColumns: arr });
  }

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const roleNameByNormalized = new Map(
    availableRoles.map((role) => [role.normalized, role.name]),
  );
  const positionCountByTitle = new Map(
    positionCounts.map((entry) => [normalizeTitleToken(entry.jobTitle), entry.count]),
  );
  const mappingsByRole = new Map<string, { jobTitle: string; count: number }[]>();
  for (const mapping of audienceMappings) {
    const key = mapping.normalizedRole;
    const current = mappingsByRole.get(key) ?? [];
    current.push({
      jobTitle: mapping.jobTitle,
      count: positionCountByTitle.get(normalizeTitleToken(mapping.jobTitle)) ?? 0,
    });
    mappingsByRole.set(key, current);
  }

  const sectionsVisibleToEveryone = sections.filter(
    (section) => (section.visibleToRoles ?? []).length === 0,
  );
  const restrictedSections = sections.filter(
    (section) => (section.visibleToRoles ?? []).length > 0,
  );
  const roleAudienceCards = Array.from(
    new Set(restrictedSections.flatMap((section) => section.visibleToRoles ?? [])),
  )
    .map((normalizedRole) => {
      const mappedPositions = [...(mappingsByRole.get(normalizedRole) ?? [])].sort(
        (a, b) => b.count - a.count || a.jobTitle.localeCompare(b.jobTitle),
      );
      const matchingReports = restrictedSections.filter((section) =>
        (section.visibleToRoles ?? []).includes(normalizedRole),
      );
      return {
        normalizedRole,
        name: roleNameByNormalized.get(normalizedRole) ?? normalizedRole,
        mappedPositions,
        assignedUserCount: assignedCounts[normalizedRole] ?? 0,
        reports: matchingReports,
      };
    })
    .sort((a, b) => b.reports.length - a.reports.length || a.name.localeCompare(b.name));

  function describeAudience(section: PipelinePanel) {
    const selectedRoles = section.visibleToRoles ?? [];
    if (selectedRoles.length === 0) {
      return {
        roles: [] as { normalized: string; name: string }[],
        positions: [] as { jobTitle: string; count: number }[],
        unrestricted: true,
      };
    }

    const positions = selectedRoles.flatMap((role) => mappingsByRole.get(role) ?? []);
    const dedupedPositions = Array.from(
      positions.reduce((map, item) => {
        const key = normalizeTitleToken(item.jobTitle);
        if (!map.has(key)) map.set(key, item);
        return map;
      }, new Map<string, { jobTitle: string; count: number }>() ).values(),
    ).sort((a, b) => b.count - a.count || a.jobTitle.localeCompare(b.jobTitle));

    return {
      roles: selectedRoles.map((role) => ({
        normalized: role,
        name: roleNameByNormalized.get(role) ?? role,
      })),
      positions: dedupedPositions,
      unrestricted: false,
    };
  }

  if (loading) {
    return (
      <div className="max-w-[1000px] mx-auto px-6 py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[1000px] mx-auto px-6 py-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Per User Reports</h1>
            <p className="text-sm text-brand-grey">
              Salesforce reports filtered per user, organized by audience roles and mapped positions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={addSection} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> Add Report
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save
          </Button>
        </div>
      </div>

      {/* Widget Visibility Toggle */}
      <div className={`flex items-center justify-between px-5 py-4 rounded-xl border shadow-sm transition-colors ${
        widgetVisible
          ? "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
          : "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700"
      }`}>
        <div className="flex items-center gap-3">
          {widgetVisible ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 dark:bg-green-900/20">
              <Eye className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <EyeOff className="w-4 h-4 text-gray-400" />
            </div>
          )}
          <div>
            <span className="font-semibold text-gray-900 dark:text-gray-100">Widget Visibility</span>
            <p className="text-xs text-brand-grey">
              {widgetVisible
                ? "Widget is visible on the dashboard"
                : "Widget is hidden from the dashboard"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setWidgetVisible(!widgetVisible)}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
            widgetVisible ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              widgetVisible ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
              toast.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {sections.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 text-center">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No Per-User Reports Yet
          </h3>
          <p className="text-sm text-brand-grey mb-6">
            Add your first report. Each one runs a Salesforce report filtered by the logged-in user&#39;s identity.
          </p>
          <Button type="button" onClick={addSection} className="gap-2">
            <Plus className="w-4 h-4" /> Add First Report
          </Button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40">
          <div className="flex items-center gap-2">
            <UserSearch className="w-4 h-4 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Audience Overview</h2>
          </div>
          <p className="text-sm text-brand-grey mt-1">
            See which roles can access each report and which directory positions map into those roles.
          </p>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Visible To Everyone</h3>
                <p className="text-xs text-brand-grey">Reports without role restrictions are available to every signed-in user.</p>
              </div>
              <Badge variant="secondary">{sectionsVisibleToEveryone.length} report{sectionsVisibleToEveryone.length === 1 ? "" : "s"}</Badge>
            </div>

            {sectionsVisibleToEveryone.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sectionsVisibleToEveryone.map((section) => (
                  <Badge key={section.id} variant="outline" className="px-2 py-1 text-xs">
                    {section.title || "Untitled"}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-brand-grey">All current reports are restricted to specific roles.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Restricted Reports By Role</h3>
                <p className="text-xs text-brand-grey">Each card shows the report list for a role and the mapped job titles that inherit that role.</p>
              </div>
              <Badge variant="secondary">{roleAudienceCards.length} role{roleAudienceCards.length === 1 ? "" : "s"}</Badge>
            </div>

            {audienceLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Skeleton className="h-36 rounded-xl" />
                <Skeleton className="h-36 rounded-xl" />
              </div>
            ) : roleAudienceCards.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {roleAudienceCards.map((card) => (
                  <div
                    key={card.normalizedRole}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{card.name}</h4>
                        <p className="text-xs text-brand-grey">
                          {card.reports.length} report{card.reports.length === 1 ? "" : "s"} restricted to this role
                        </p>
                      </div>
                      <Badge variant="outline">{card.assignedUserCount} assigned in Logto</Badge>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-grey mb-1.5">Reports</p>
                      <div className="flex flex-wrap gap-2">
                        {card.reports.map((section) => (
                          <Badge key={section.id} variant="secondary" className="text-xs px-2 py-1">
                            {section.title || "Untitled"}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-grey mb-1.5">Mapped Positions</p>
                      {card.mappedPositions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {card.mappedPositions.map((position) => (
                            <Badge key={`${card.normalizedRole}-${position.jobTitle}`} variant="outline" className="text-xs px-2 py-1">
                              {position.jobTitle} ({position.count})
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-brand-grey">No mapped positions found for this role.</p>
                      )}
                      <p className="text-[11px] text-brand-grey mt-2">
                        Position chips are directory mappings only. The badge above shows actual current Logto role assignments.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-brand-grey">No role-restricted reports yet. Once you restrict a report to roles, it will appear here.</p>
            )}
          </div>
        </div>
      </div>

      {/* Report list */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {sections.map((section, idx) => {
            const isExpanded = expandedId === section.id;
            const cols = sectionColumns[section.id] ?? [];
            const audience = describeAudience(section);

            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
              >
                {/* Collapsed header */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
                  onClick={() => setExpandedId(isExpanded ? null : section.id)}
                >
                  <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => moveSection(section.id, "up")}
                      disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => moveSection(section.id, "down")}
                      disabled={idx === sections.length - 1}
                      className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  </div>

                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      section.displayMode === "stat"
                        ? "bg-emerald-50 text-emerald-500"
                        : section.displayMode === "chart"
                        ? "bg-violet-50 text-violet-500"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {section.displayMode === "stat" ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : section.displayMode === "chart" ? (
                      <PieChartIcon className="w-4 h-4" />
                    ) : (
                      <Table2 className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {section.title || "Untitled"}
                      </span>
                      <Badge
                        variant={section.enabled ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {section.enabled ? "ON" : "OFF"}
                      </Badge>
                      {section.filterColumn && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-600">
                          <Filter className="w-2.5 h-2.5 mr-0.5" />
                          {section.filterMatchBy}
                        </Badge>
                      )}
                      {section.reportFilters && section.reportFilters.some((f) => f.replaceWithUser) && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-600">
                          <Filter className="w-2.5 h-2.5 mr-0.5" />
                          {section.reportFilters.filter((f) => f.replaceWithUser).length} user filter{section.reportFilters.filter((f) => f.replaceWithUser).length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {(section.visibleToRoles ?? []).length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600">
                          {section.visibleToRoles!.length} role{section.visibleToRoles!.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {section.visibleToSuperAdminOnly && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-600">
                          Super admin only
                        </Badge>
                      )}
                      {audience.unrestricted && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-sky-300 text-sky-700">
                          Everyone
                        </Badge>
                      )}
                    </div>
                    {section.reportName && (
                      <span className="text-xs text-brand-grey truncate block">
                        {section.reportName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {section.reportId && (
                      <button
                        onClick={() => handleRefresh(section.id)}
                        disabled={refreshingSection === section.id}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="Refresh data (as yourself)"
                      >
                        {refreshingSection === section.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => removeSection(section.id)}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete report"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                {/* Expanded editor */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-5 space-y-5">
                        {/* Title + Enable */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Report Title
                            </label>
                            <Input
                              value={section.title}
                              onChange={(e) => updateSection(section.id, { title: e.target.value })}
                              placeholder="e.g. My Loans Closing This Month"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Enabled
                            </label>
                            <button
                              onClick={() => updateSection(section.id, { enabled: !section.enabled })}
                              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                                section.enabled ? "bg-brand-blue" : "bg-gray-300 dark:bg-gray-600"
                              }`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                  section.enabled ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {availableRoles.length > 0 && (
                          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10 p-4 space-y-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <UserSearch className="w-4 h-4 text-amber-600" />
                                <span className="font-semibold text-sm text-amber-800 dark:text-amber-300">Audience</span>
                              </div>
                              <p className="text-xs text-brand-grey">
                                Control who can see this report by role, then review the mapped directory positions below.
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Preview Visibility
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSection(section.id, {
                                    visibleToSuperAdminOnly: !section.visibleToSuperAdminOnly,
                                  })
                                }
                                className={`mb-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                                  section.visibleToSuperAdminOnly
                                    ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
                                    : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300"
                                }`}
                              >
                                <span
                                  className={`inline-flex h-3.5 w-3.5 rounded-full border ${
                                    section.visibleToSuperAdminOnly
                                      ? "border-red-500 bg-red-500"
                                      : "border-gray-300 dark:border-gray-600"
                                  }`}
                                />
                                Visible to only super admin
                              </button>
                              <p className="text-xs text-brand-grey mb-2">
                                Use this while building the report so only SUPER_ADMIN users can preview it on the dashboard.
                              </p>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Visible to Roles
                              </label>
                              <p className="text-xs text-brand-grey mb-2">
                                If none selected, every signed-in user can see this report. Admins always see all reports unless super-admin-only preview is enabled.
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {availableRoles.map((role) => {
                                  const isSelected = (section.visibleToRoles ?? []).includes(role.normalized);
                                  return (
                                    <button
                                      key={role.id}
                                      onClick={() => {
                                        const current = section.visibleToRoles ?? [];
                                        updateSection(section.id, {
                                          visibleToRoles: isSelected
                                            ? current.filter((r) => r !== role.normalized)
                                            : [...current, role.normalized],
                                        });
                                      }}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                                        isSelected
                                          ? "border-brand-blue bg-brand-blue/5 text-gray-900 dark:text-gray-100 font-medium"
                                          : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                                      }`}
                                    >
                                      <div
                                        className={`flex h-3.5 w-3.5 items-center justify-center rounded border-2 shrink-0 transition-colors ${
                                          isSelected
                                            ? "border-brand-blue bg-brand-blue text-white"
                                            : "border-gray-300 dark:border-gray-600"
                                        }`}
                                      >
                                        {isSelected && (
                                          <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                      {role.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Who Can See This Report
                              </label>
                              {section.visibleToSuperAdminOnly ? (
                                <p className="text-xs text-red-600 dark:text-red-300">
                                  Preview mode is active: only SUPER_ADMIN users can see this report until you turn this off.
                                </p>
                              ) : audience.unrestricted ? (
                                <p className="text-xs text-sky-700 dark:text-sky-300">
                                  Visible to everyone. Role and position restrictions are not applied for this report.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-2">
                                    {audience.roles.map((role) => (
                                      <Badge key={role.normalized} variant="secondary" className="text-xs px-2 py-1">
                                        {role.name}
                                      </Badge>
                                    ))}
                                  </div>
                                  {audience.positions.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {audience.positions.map((position) => (
                                        <Badge key={position.jobTitle} variant="outline" className="text-xs px-2 py-1">
                                          {position.jobTitle} ({position.count})
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-brand-grey">
                                      No mapped positions found for the selected roles. Review Role Mappings if this looks wrong.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Report URL */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Salesforce Report URL or ID
                          </label>
                          <div className="flex gap-2">
                            <Input
                              value={section.reportUrl}
                              onChange={(e) => {
                                const url = e.target.value;
                                const id = extractReportId(url);
                                updateSection(section.id, {
                                  reportUrl: url,
                                  ...(id ? { reportId: id } : {}),
                                });
                                if (id && id !== section.reportId) {
                                  describeForSection(section.id, url, false);
                                }
                              }}
                              placeholder="https://yourorg.lightning.force.com/lightning/r/Report/00O.../view"
                              className="flex-1"
                            />
                            <Button
                              onClick={() => describeForSection(section.id, section.reportUrl)}
                              disabled={describingSection === section.id}
                              variant="outline"
                              className="gap-2 shrink-0"
                            >
                              {describingSection === section.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Search className="w-4 h-4" />
                              )}
                              Fetch Report
                            </Button>
                          </div>
                          {section.reportId && (
                            <div className="flex items-center gap-2 text-sm mt-2">
                              <Badge variant="secondary" className="font-mono text-xs">
                                {section.reportId}
                              </Badge>
                              {section.reportName && (
                                <span className="text-brand-grey">{section.reportName}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* ─── Report Filters ─── */}
                        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 space-y-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Filter className="w-4 h-4 text-emerald-600" />
                            <span className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
                              Report Filters
                            </span>
                            {section.filterLogic && (
                              <Badge variant="secondary" className="text-xs font-mono">
                                Logic: {section.filterLogic}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-brand-grey">
                            These are the report&apos;s built-in filters. Filters with <code className="bg-emerald-100 dark:bg-emerald-900 px-1 rounded">$USER</code> can be
                            toggled to replace with the logged-in user&apos;s name or email at runtime.
                          </p>

                          {section.reportFilters && section.reportFilters.length > 0 ? (
                            <div className="space-y-3">
                              {section.reportFilters.map((filter, filterIdx) => (
                                <div
                                  key={filterIdx}
                                  className={`rounded-lg border p-3 space-y-2 ${
                                    filter.replaceWithUser
                                      ? "border-emerald-400 dark:border-emerald-600 bg-emerald-100/50 dark:bg-emerald-900/20"
                                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className="text-xs font-mono text-brand-grey shrink-0">
                                        [{filterIdx + 1}]
                                      </span>
                                      <span className="text-sm font-medium truncate">{filter.column}</span>
                                      <Badge variant="outline" className="text-xs shrink-0">
                                        {filter.operator}
                                      </Badge>
                                      <span className="text-xs text-brand-grey truncate max-w-[200px]" title={filter.value}>
                                        {filter.value.length > 40 ? filter.value.slice(0, 40) + "…" : filter.value}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        const updated = [...(section.reportFilters ?? [])];
                                        updated[filterIdx] = {
                                          ...updated[filterIdx],
                                          replaceWithUser: !updated[filterIdx].replaceWithUser,
                                        };
                                        updateSection(section.id, { reportFilters: updated });
                                      }}
                                      className={`shrink-0 px-3 py-1 rounded-lg border text-xs font-medium transition-all ${
                                        filter.replaceWithUser
                                          ? "border-emerald-500 bg-emerald-500 text-white"
                                          : "border-gray-300 dark:border-gray-600 text-gray-500 hover:border-emerald-400"
                                      }`}
                                    >
                                      {filter.replaceWithUser ? "✓ Replace $USER" : "Static"}
                                    </button>
                                  </div>

                                  {filter.replaceWithUser && (
                                    <div className="flex items-center gap-2 pl-6">
                                      <span className="text-xs text-emerald-700 dark:text-emerald-400">
                                        Match user by:
                                      </span>
                                      <button
                                        onClick={() => {
                                          const updated = [...(section.reportFilters ?? [])];
                                          updated[filterIdx] = { ...updated[filterIdx], matchBy: "name" };
                                          updateSection(section.id, { reportFilters: updated });
                                        }}
                                        className={`px-2 py-0.5 rounded border text-xs transition-all ${
                                          (filter.matchBy ?? "name") === "name"
                                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium"
                                            : "border-gray-200 dark:border-gray-700 text-gray-500"
                                        }`}
                                      >
                                        Name
                                      </button>
                                      <button
                                        onClick={() => {
                                          const updated = [...(section.reportFilters ?? [])];
                                          updated[filterIdx] = { ...updated[filterIdx], matchBy: "email" };
                                          updateSection(section.id, { reportFilters: updated });
                                        }}
                                        className={`px-2 py-0.5 rounded border text-xs transition-all ${
                                          filter.matchBy === "email"
                                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium"
                                            : "border-gray-200 dark:border-gray-700 text-gray-500"
                                        }`}
                                      >
                                        Email
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-brand-grey italic">
                              No filters found. Click &quot;Fetch Columns&quot; above to load the report&apos;s filters.
                            </p>
                          )}
                        </div>

                        {/* Display Mode + Column Span + Highlight Top N */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Display Mode
                            </label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateSection(section.id, { displayMode: "table" })}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                                  section.displayMode === "table"
                                    ? "border-brand-blue bg-brand-blue/5 text-gray-900 dark:text-gray-100 font-medium"
                                    : "border-gray-200 dark:border-gray-700 text-gray-500"
                                }`}
                              >
                                <Table2 className="w-4 h-4" /> Table
                              </button>
                              <button
                                onClick={() => updateSection(section.id, { displayMode: "stat" })}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                                  section.displayMode === "stat"
                                    ? "border-emerald-500 bg-emerald-50 text-gray-900 dark:text-gray-100 font-medium"
                                    : "border-gray-200 dark:border-gray-700 text-gray-500"
                                }`}
                              >
                                <TrendingUp className="w-4 h-4" /> Stat
                              </button>
                              <button
                                onClick={() => updateSection(section.id, { displayMode: "chart" })}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                                  section.displayMode === "chart"
                                    ? "border-violet-500 bg-violet-50 text-gray-900 dark:text-gray-100 font-medium"
                                    : "border-gray-200 dark:border-gray-700 text-gray-500"
                                }`}
                              >
                                <PieChartIcon className="w-4 h-4" /> Chart
                              </button>
                            </div>
                          </div>
                          {section.displayMode === "table" && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Highlight Top N
                              </label>
                              <select
                                value={section.highlightTopN}
                                onChange={(e) =>
                                  updateSection(section.id, { highlightTopN: Number(e.target.value) })
                                }
                                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                              >
                                <option value={0}>None</option>
                                <option value={1}>Top 1</option>
                                <option value={2}>Top 2</option>
                                <option value={3}>Top 3</option>
                                <option value={4}>Top 4</option>
                                <option value={5}>Top 5</option>
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Stat mode options */}
                        {section.displayMode === "stat" && cols.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Stat Column
                              </label>
                              <select
                                value={section.statColumn || ""}
                                onChange={(e) =>
                                  updateSection(section.id, {
                                    statColumn: e.target.value || undefined,
                                  })
                                }
                                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                              >
                                <option value="">First column (default)</option>
                                {cols.map((c) => (
                                  <option key={c.name} value={c.name}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Stat Label
                              </label>
                              <Input
                                value={section.statLabel || ""}
                                onChange={(e) =>
                                  updateSection(section.id, { statLabel: e.target.value })
                                }
                                placeholder={section.title || "Label above the number"}
                              />
                            </div>
                          </div>
                        )}

                        {/* Chart mode options */}
                        {section.displayMode === "chart" && cols.length > 0 && (
                          <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10 p-4 space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                              <PieChartIcon className="w-4 h-4 text-violet-600" />
                              <span className="font-semibold text-sm text-violet-800 dark:text-violet-300">
                                Pie Chart Settings
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Label Column (slices)
                                </label>
                                <select
                                  value={section.chartLabelColumn || ""}
                                  onChange={(e) =>
                                    updateSection(section.id, {
                                      chartLabelColumn: e.target.value || undefined,
                                    })
                                  }
                                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                >
                                  <option value="">First column (default — grouping)</option>
                                  {cols.map((c) => (
                                    <option key={c.name} value={c.name}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                                <p className="text-xs text-brand-grey mt-1">
                                  Each unique value becomes a pie slice
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Value Column (size)
                                </label>
                                <select
                                  value={section.chartValueColumn || ""}
                                  onChange={(e) =>
                                    updateSection(section.id, {
                                      chartValueColumn: e.target.value || undefined,
                                    })
                                  }
                                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                >
                                  <option value="">Last column (default — Record Count)</option>
                                  {cols.map((c) => (
                                    <option key={c.name} value={c.name}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                                <p className="text-xs text-brand-grey mt-1">
                                  Numeric column that determines each slice&#39;s size
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Refresh */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Refresh Interval (minutes)
                            </label>
                            <Input
                              type="number"
                              min={5}
                              max={1440}
                              value={section.refreshMinutes}
                              onChange={(e) =>
                                updateSection(section.id, {
                                  refreshMinutes: Number(e.target.value) || 15,
                                })
                              }
                              className="w-32"
                            />
                          </div>
                        </div>

                        {/* Sort order */}
                        {cols.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Sort By Column
                              </label>
                              <select
                                value={section.sortColumn || ""}
                                onChange={(e) =>
                                  updateSection(section.id, {
                                    sortColumn: e.target.value || undefined,
                                  })
                                }
                                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                              >
                                <option value="">Default (Salesforce order)</option>
                                {cols.map((c) => (
                                  <option key={c.name} value={c.name}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {section.sortColumn && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Sort Direction
                                </label>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => updateSection(section.id, { sortDirection: "asc" })}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                                      (section.sortDirection || "asc") === "asc"
                                        ? "border-brand-blue bg-brand-blue/5 text-gray-900 dark:text-gray-100 font-medium"
                                        : "border-gray-200 dark:border-gray-700 text-gray-500"
                                    }`}
                                  >
                                    <ArrowUp className="w-4 h-4" /> Ascending
                                  </button>
                                  <button
                                    onClick={() => updateSection(section.id, { sortDirection: "desc" })}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                                      section.sortDirection === "desc"
                                        ? "border-brand-blue bg-brand-blue/5 text-gray-900 dark:text-gray-100 font-medium"
                                        : "border-gray-200 dark:border-gray-700 text-gray-500"
                                    }`}
                                  >
                                    <ArrowDown className="w-4 h-4" /> Descending
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Column selection (table mode) */}
                        {section.displayMode === "table" && cols.length > 0 && (
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Select Columns
                                  </label>
                                  <p className="text-xs text-brand-grey">
                                    {section.visibleColumns.length}/{cols.length} selected
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      updateSection(section.id, {
                                        visibleColumns: cols.map((c) => c.name),
                                      })
                                    }
                                    className="text-xs"
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-1" /> All
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      updateSection(section.id, { visibleColumns: [] })
                                    }
                                    className="text-xs"
                                  >
                                    <EyeOff className="w-3.5 h-3.5 mr-1" /> None
                                  </Button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {cols.map((col) => {
                                  const selected = section.visibleColumns.includes(col.name);
                                  return (
                                    <button
                                      key={col.name}
                                      onClick={() => toggleColumn(section.id, col.name)}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                                        selected
                                          ? "border-brand-blue bg-brand-blue/5 text-gray-900 dark:text-gray-100"
                                          : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                                      }`}
                                    >
                                      <div
                                        className={`flex h-3.5 w-3.5 items-center justify-center rounded border-2 shrink-0 transition-colors ${
                                          selected
                                            ? "border-brand-blue bg-brand-blue text-white"
                                            : "border-gray-300 dark:border-gray-600"
                                        }`}
                                      >
                                        {selected && (
                                          <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                      <span className="truncate">{col.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {section.visibleColumns.length > 0 && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Column Order &amp; Labels
                                </label>
                                <p className="text-xs text-brand-grey mb-2">
                                  Use arrows to reorder how columns appear in the widget
                                </p>
                                <div className="space-y-1">
                                  {section.visibleColumns.map((colName, colIdx) => {
                                    const colInfo = cols.find((c) => c.name === colName);
                                    if (!colInfo) return null;
                                    return (
                                      <div
                                        key={colName}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                                      >
                                        <span className="text-xs font-mono text-brand-grey w-5 text-center shrink-0">
                                          {colIdx + 1}
                                        </span>
                                        <div className="flex flex-col gap-0.5 shrink-0">
                                          <button
                                            onClick={() => moveColumnInSection(section.id, colName, "up")}
                                            disabled={colIdx === 0}
                                            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
                                          >
                                            <ArrowUp className="w-3 h-3 text-gray-500" />
                                          </button>
                                          <button
                                            onClick={() => moveColumnInSection(section.id, colName, "down")}
                                            disabled={colIdx === section.visibleColumns.length - 1}
                                            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
                                          >
                                            <ArrowDown className="w-3 h-3 text-gray-500" />
                                          </button>
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[120px] truncate">
                                          {colInfo.label}
                                        </span>
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                          <Pencil className="w-3 h-3 text-brand-grey shrink-0" />
                                          <Input
                                            value={section.columnLabels[colName] ?? ""}
                                            onChange={(e) =>
                                              updateSection(section.id, {
                                                columnLabels: {
                                                  ...section.columnLabels,
                                                  [colName]: e.target.value,
                                                },
                                              })
                                            }
                                            placeholder={colInfo.label}
                                            className="h-7 text-xs"
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {cols.length === 0 && section.reportId && (
                          <p className="text-sm text-brand-grey">
                            Columns will load automatically. Click &quot;Fetch Columns&quot; if needed.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Bottom save */}
      {sections.length > 0 && (
        <div className="flex justify-end pt-2">
          <Button type="button" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Settings
          </Button>
        </div>
      )}

      {/* ─── Test As User ─────────────────────────────────── */}
      {sections.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-orange-50/50 dark:bg-orange-900/10 border-b border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2">
              <UserSearch className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-bold text-orange-800 dark:text-orange-300">
                Preview As User
              </h2>
            </div>
            <p className="text-xs text-brand-grey mt-1">
              Run a report with a specific name or email to preview what that user would see.
            </p>
          </div>

          <div className="px-5 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Panel picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Panel
                </label>
                <select
                  value={testPanelId}
                  onChange={(e) => {
                    setTestPanelId(e.target.value);
                    setTestResult(null);
                    setTestError(null);
                  }}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                >
                  <option value="">Select a panel...</option>
                  {sections.map((s) => {
                    const hasFilters = s.reportFilters?.some((f) => f.replaceWithUser) || !!s.filterColumn;
                    const isReady = !!s.reportId && hasFilters;
                    return (
                      <option
                        key={s.id}
                        value={s.id}
                        disabled={!isReady}
                      >
                        {s.title || "Untitled"}
                        {isReady
                          ? ` (${s.reportFilters?.filter((f) => f.replaceWithUser).length || 1} user filter${(s.reportFilters?.filter((f) => f.replaceWithUser).length || 1) > 1 ? "s" : ""})`
                          : " — needs report + filters"}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Test value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name or Email to test
                </label>
                <Input
                  value={testValue}
                  onChange={(e) => setTestValue(e.target.value)}
                  placeholder="John Doe"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTestRun();
                  }}
                />
              </div>

              {/* Run button */}
              <div className="flex items-end">
                <Button
                  onClick={handleTestRun}
                  disabled={testRunning || !testPanelId || !testValue.trim()}
                  className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {testRunning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Run Test
                </Button>
              </div>
            </div>

            {/* Error */}
            {testError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {testError}
              </div>
            )}

            {/* Results */}
            {testResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                      {testResult.panelTitle}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {testResult.totalRows} {testResult.totalRows === 1 ? "row" : "rows"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      &quot;{testResult.testValue}&quot;
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-brand-grey">{testResult.reportName}</span>
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await fetch("/api/active-pipeline/view-as", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: testResult.testValue, email: testResult.testValue }),
                          });
                          showToast("success", `Dashboard now showing as "${testResult.testValue}". Go to your dashboard to see it.`);
                        } catch {
                          showToast("error", "Failed to set view-as mode");
                        }
                      }}
                      className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View on Dashboard
                    </Button>
                  </div>
                </div>

                {testResult.rows.length > 0 ? (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-50 dark:bg-gray-800/80">
                          <th className="px-3 py-2 text-left text-[11px] font-semibold text-brand-grey uppercase tracking-wider w-10">
                            #
                          </th>
                          {testResult.columns.map((col) => (
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
                        {testResult.rows.map((row, i) => (
                          <tr
                            key={i}
                            className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30"
                          >
                            <td className="px-3 py-2 text-xs font-bold text-brand-grey">
                              {i + 1}
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-brand-grey rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    No rows returned for &quot;{testResult.testValue}&quot;
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
