// ProConnect — Admin Salesforce Report Widget Settings
// Configure multiple report sections displayed inside one dashboard widget.

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
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
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SfReportPanel } from "@/types/salesforce-panels";

interface ColumnInfo {
  name: string;
  label: string;
  dataType?: string;
}

/** Client-side extraction of report ID from URL or bare ID */
function extractReportId(input: string): string | null {
  const trimmed = input.trim();
  if (/^00O[A-Za-z0-9]{12,15}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/Report\/([A-Za-z0-9]{15,18})/i);
  return match?.[1] ?? null;
}

const DEFAULT_SECTION: Omit<SfReportPanel, "id" | "order"> = {
  enabled: true,
  title: "New Report",
  displayMode: "table",
  reportUrl: "",
  reportId: "",
  reportName: "",
  visibleColumns: [],
  columnLabels: {},
  maxRows: 15,
  refreshMinutes: 30,
  highlightTopN: 0,
  visibleToSuperAdminOnly: false,
};

export default function SalesforceReportAdminPage() {
  const [sections, setSections] = useState<SfReportPanel[]>([]);
  const [widgetVisible, setWidgetVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Track which section is expanded for editing
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Per-section available columns (loaded when describing)
  const [sectionColumns, setSectionColumns] = useState<Record<string, ColumnInfo[]>>({});
  const [describingSection, setDescribingSection] = useState<string | null>(null);
  const [refreshingSection, setRefreshingSection] = useState<string | null>(null);

  // Available Logto roles for visibility picker
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string; normalized: string }[]>([]);

  // ─── Load config ───────────────────────────────────────
  const loadSections = useCallback(async () => {
    try {
      const res = await fetch("/api/salesforce/report-panels?admin=1");
      if (res.ok) {
        const data = await res.json();
        if (data.config?.panels) {
          setSections(data.config.panels);
          setWidgetVisible(data.config.widgetVisible !== false);
          for (const section of data.config.panels as SfReportPanel[]) {
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
    // Load available Logto roles
    fetch("/api/salesforce/report-panels/roles")
      .then((r) => r.ok ? r.json() : { roles: [] })
      .then((data) => setAvailableRoles(data.roles ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Describe a report for a specific section ─────────
  async function describeForSection(sectionId: string, url: string, silent = false) {
    if (!url) return;
    if (!silent) setDescribingSection(sectionId);
    try {
      const res = await fetch("/api/salesforce/report-panels/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Describe failed");

      setSectionColumns((prev) => ({ ...prev, [sectionId]: data.columns ?? [] }));

      if (!silent) {
        setSections((prev) =>
          prev.map((s) =>
            s.id === sectionId
              ? { ...s, reportId: data.reportId, reportName: data.reportName }
              : s,
          ),
        );
        showToast("success", `Found: "${data.reportName}" (${data.columns.length} columns)`);
      }
    } catch (err) {
      if (!silent) {
        showToast("error", err instanceof Error ? err.message : "Failed to describe report");
      }
    } finally {
      if (!silent) setDescribingSection(null);
    }
  }

  // ─── Save all sections ────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/salesforce/report-panels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetVisible, panels: sections }),
      });
      if (!res.ok) throw new Error("Save failed");
      showToast("success", "Widget settings saved!");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // ─── Force refresh a section ──────────────────────────
  async function handleRefresh(sectionId: string) {
    setRefreshingSection(sectionId);
    try {
      const res = await fetch("/api/salesforce/report-panels/refresh", {
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

  // ─── Section CRUD helpers ─────────────────────────────
  function addSection() {
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const newSection: SfReportPanel = {
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

  function updateSection(id: string, updates: Partial<SfReportPanel>) {
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

  // ─── Render ───────────────────────────────────────────
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue text-white">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Salesforce Report Widget</h1>
            <p className="text-sm text-brand-grey">
              Add multiple report sections inside one widget on the dashboard
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={addSection} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> Add Section
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
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              Widget Visibility
            </span>
            <p className="text-xs text-brand-grey">
              {widgetVisible
                ? "Widget is visible on the dashboard for all users"
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
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No Report Sections Yet
          </h3>
          <p className="text-sm text-brand-grey mb-6">
            Add your first section — each one displays a Salesforce report as a table or stat card inside the widget.
          </p>
          <Button type="button" onClick={addSection} className="gap-2">
            <Plus className="w-4 h-4" /> Add First Section
          </Button>
        </div>
      )}

      {/* Section list */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {sections.map((section, idx) => {
            const isExpanded = expandedId === section.id;
            const cols = sectionColumns[section.id] ?? [];

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
                  {/* Reorder */}
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

                  {/* Icon */}
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      section.displayMode === "stat"
                        ? "bg-emerald-50 text-emerald-500"
                        : "bg-blue-50 text-blue-500"
                    }`}
                  >
                    {section.displayMode === "stat" ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <Table2 className="w-4 h-4" />
                    )}
                  </div>

                  {/* Info */}
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
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {section.displayMode === "stat" ? "Stat" : "Table"}
                      </Badge>

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
                    </div>
                    {section.reportName && (
                      <span className="text-xs text-brand-grey truncate block">
                        {section.reportName}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {section.reportId && (
                      <button
                        onClick={() => handleRefresh(section.id)}
                        disabled={refreshingSection === section.id}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="Refresh data"
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
                      title="Delete section"
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
                              Section Title
                            </label>
                            <Input
                              value={section.title}
                              onChange={(e) => updateSection(section.id, { title: e.target.value })}
                              placeholder="e.g. Top Sales This Month"
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

                        {/* Visible to Roles */}
                        {availableRoles.length > 0 && (
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
                              If none selected, everyone can see this section. Admins always see all sections unless super-admin-only preview is enabled.
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
                            {(section.visibleToRoles ?? []).length > 0 && (
                              <p className="text-xs text-brand-blue mt-1.5">
                                Restricted to: {(section.visibleToRoles ?? []).join(", ")}
                              </p>
                            )}
                            {section.visibleToSuperAdminOnly && (
                              <p className="text-xs text-red-600 mt-1.5">
                                Preview mode is active: role restrictions are ignored until you turn off super-admin-only visibility.
                              </p>
                            )}
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
                              Fetch Columns
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
                              <p className="text-xs text-brand-grey mt-1">
                                Which column value to show as the big number
                              </p>
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

                        {/* Max rows + Refresh */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Max Rows
                            </label>
                            <Input
                              type="number"
                              min={1}
                              max={200}
                              value={section.maxRows}
                              onChange={(e) =>
                                updateSection(section.id, {
                                  maxRows: Number(e.target.value) || 15,
                                })
                              }
                              className="w-32"
                            />
                          </div>
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
                                  refreshMinutes: Number(e.target.value) || 30,
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
                            {/* Toggle columns on/off */}
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

                            {/* Column order + custom labels */}
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
                                        {/* Position badge */}
                                        <span className="text-xs font-mono text-brand-grey w-5 text-center shrink-0">
                                          {colIdx + 1}
                                        </span>
                                        {/* Reorder arrows */}
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
                                        {/* Column name */}
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[120px] truncate">
                                          {colInfo.label}
                                        </span>
                                        {/* Custom label input */}
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
    </motion.div>
  );
}
