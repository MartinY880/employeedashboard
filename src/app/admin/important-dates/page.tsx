// ProConnect — Admin Important Dates Management Page
// CRUD table for managing dashboard important dates

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Loader2,
  RefreshCw,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSounds } from "@/components/shared/SoundProvider";

interface ImportantDateItem {
  id: string;
  label: string;
  subtitle?: string | null;
  date: string;
  recurType: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

function formatDateForInput(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toISOString().split("T")[0];
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function AdminImportantDatesPage() {
  const { playClick, playSuccess, playPop } = useSounds();
  const [dates, setDates] = useState<ImportantDateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<ImportantDateItem | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formSubtitle, setFormSubtitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formRecurType, setFormRecurType] = useState("none");

  // Sort state
  const [sortBy, setSortBy] = useState<"order" | "date">("order");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{ label: string; subtitle: string; date: string; recurType: string; active: boolean }[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);

  const fetchDates = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/important-dates?all=true");
      const data = await res.json();
      setDates(
        (data.dates || []).sort(
          (a: ImportantDateItem, b: ImportantDateItem) => a.sortOrder - b.sortOrder
        )
      );
    } catch {
      console.error("Failed to fetch important dates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDates(); }, [fetchDates]);

  const openCreateDialog = () => {
    playClick();
    setEditingDate(null);
    setFormLabel("");
    setFormSubtitle("");
    setFormDate("");
    setFormRecurType("none");
    setDialogOpen(true);
  };

  const openEditDialog = (item: ImportantDateItem) => {
    playClick();
    setEditingDate(item);
    setFormLabel(item.label);
    setFormSubtitle(item.subtitle || "");
    setFormDate(formatDateForInput(item.date));
    setFormRecurType(item.recurType || "none");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formLabel.trim() || !formDate) return;
    setSaving(true);
    try {
      if (editingDate) {
        const res = await fetch("/api/important-dates", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingDate.id,
            label: formLabel.trim(),
            subtitle: formSubtitle.trim(),
            date: formDate,
            recurType: formRecurType,
          }),
        });
        if (res.ok) {
          playSuccess();
          setDialogOpen(false);
          fetchDates();
        }
      } else {
        const res = await fetch("/api/important-dates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: formLabel.trim(),
            subtitle: formSubtitle.trim(),
            date: formDate,
            recurType: formRecurType,
            sortOrder: dates.length,
          }),
        });
        if (res.ok) {
          playSuccess();
          setDialogOpen(false);
          fetchDates();
        }
      }
    } catch {
      console.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/important-dates?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        playPop();
        setDeletingId(null);
        fetchDates();
      }
    } catch {
      console.error("Delete failed");
    }
  };

  const handleToggleActive = async (item: ImportantDateItem) => {
    playClick();
    try {
      await fetch("/api/important-dates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, active: !item.active }),
      });
      fetchDates();
    } catch {
      console.error("Toggle failed");
    }
  };

  /* ── CSV Export / Import ── */
  const CSV_HEADERS = "Label,Subtitle,Date,Recurrence,Active";
  const CSV_TEMPLATE = `${CSV_HEADERS}\nRate Lock Deadline,Lock cutoff for the month,2026-03-15,none,true\nPayroll Due,Submit timesheets,2026-04-01,monthly,true\nFirst Workday Meeting,,2026-03-02,first_workday,true`;

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportTemplate = () => {
    playClick();
    downloadCSV(CSV_TEMPLATE, "important-dates-template.csv");
  };

  const handleExportDates = () => {
    playClick();
    if (dates.length === 0) return;
    const rows = dates.map((d) => {
      const dateStr = new Date(d.date).toISOString().split("T")[0];
      return `"${d.label.replace(/"/g, '""')}","${(d.subtitle || "").replace(/"/g, '""')}",${dateStr},${d.recurType || "none"},${d.active}`;
    });
    downloadCSV([CSV_HEADERS, ...rows].join("\n"), "important-dates-export.csv");
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportResult(null);
    setImportPreview([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const rows = parseCSVPreview(text);
        if (rows.length === 0) {
          setImportError("No valid rows found. Make sure CSV has Label and Date columns.");
        } else {
          setImportPreview(rows);
        }
        setImportDialogOpen(true);
      } catch (err: unknown) {
        setImportError(err instanceof Error ? err.message : "Failed to parse CSV");
        setImportDialogOpen(true);
      }
    };
    reader.readAsText(file);
    // Reset input so re-selecting same file triggers change event
    e.target.value = "";
  };

  const parseCSVPreview = (text: string): { label: string; subtitle: string; date: string; recurType: string; active: boolean }[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
    const labelIdx = header.findIndex((h) => h === "label" || h === "name" || h === "title");
    const subtitleIdx = header.findIndex((h) => h === "subtitle" || h === "sublabel" || h === "description");
    const dateIdx = header.findIndex((h) => h === "date");
    const recurIdx = header.findIndex((h) => h.includes("recur") || h === "type" || h === "recurring");
    const activeIdx = header.findIndex((h) => h === "active" || h === "enabled" || h === "status");

    if (labelIdx === -1 || dateIdx === -1) throw new Error("CSV must contain 'Label' and 'Date' columns");

    const rows: { label: string; subtitle: string; date: string; recurType: string; active: boolean }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVCols(lines[i]);
      const label = cols[labelIdx]?.trim();
      const dateStr = cols[dateIdx]?.trim();
      if (!label || !dateStr) continue;
      const parsed = new Date(dateStr + "T00:00:00Z");
      if (isNaN(parsed.getTime())) continue;

      let subtitle = "";
      if (subtitleIdx !== -1) {
        subtitle = (cols[subtitleIdx] || "").trim();
      }

      let recurType = "none";
      if (recurIdx !== -1) {
        const raw = (cols[recurIdx] || "").trim().toLowerCase();
        if (raw === "monthly" || raw === "month") recurType = "monthly";
        else if (raw === "first_workday" || raw === "first workday" || raw === "1st workday") recurType = "first_workday";
      }

      let active = true;
      if (activeIdx !== -1) {
        const raw = (cols[activeIdx] || "").trim().toLowerCase();
        if (raw === "false" || raw === "no" || raw === "0" || raw === "inactive") active = false;
      }

      rows.push({ label, subtitle, date: dateStr, recurType, active });
    }
    return rows;
  };

  const parseCSVCols = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = false;
        } else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ",") { result.push(current); current = ""; }
        else current += ch;
      }
    }
    result.push(current);
    return result;
  };

  const handleImportConfirm = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      // Reconstruct CSV from preview rows
      const csvLines = [CSV_HEADERS];
      importPreview.forEach((r) => {
        csvLines.push(`"${r.label.replace(/"/g, '""')}","${(r.subtitle || "").replace(/"/g, '""')}",${r.date},${r.recurType},${r.active}`);
      });
      const res = await fetch("/api/important-dates/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvLines.join("\n") }),
      });
      const data = await res.json();
      if (res.ok) {
        playSuccess();
        setImportResult({ imported: data.imported });
        setImportPreview([]);
        fetchDates();
      } else {
        setImportError(data.error || "Import failed");
      }
    } catch {
      setImportError("Import request failed");
    } finally {
      setImporting(false);
    }
  };

  // Compute sorted dates for display
  const sortedDates = sortBy === "date"
    ? [...dates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : dates;

  const handleReorder = async (index: number, direction: "up" | "down") => {
    const newDates = [...dates];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newDates.length) return;

    playClick();
    [newDates[index], newDates[swapIdx]] = [newDates[swapIdx], newDates[index]];

    // Update sort orders
    try {
      await Promise.all(
        newDates.map((d, i) =>
          fetch("/api/important-dates", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: d.id, sortOrder: i }),
          })
        )
      );
      fetchDates();
    } catch {
      console.error("Reorder failed");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center gap-1 text-sm text-brand-grey hover:text-brand-blue transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Admin
          </Link>
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-950/50 text-pink-500">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Important Dates</h1>
              <p className="text-xs text-brand-grey">Manage dates displayed on the dashboard</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Export template */}
          <Button variant="outline" size="sm" onClick={handleExportTemplate} className="gap-1.5 text-xs">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Template
          </Button>
          {/* Export current dates */}
          <Button variant="outline" size="sm" onClick={handleExportDates} disabled={dates.length === 0} className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
          {/* Import CSV */}
          <Button variant="outline" size="sm" onClick={() => document.getElementById("csv-import-input")?.click()} className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" />
            Import
          </Button>
          <input
            id="csv-import-input"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
          <Button onClick={openCreateDialog} className="bg-brand-blue hover:bg-brand-blue/90 text-white gap-1.5">
            <Plus className="w-4 h-4" />
            Add Date
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : dates.length === 0 ? (
        <div className="text-center py-16 text-brand-grey">
          <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No important dates yet.</p>
          <p className="text-xs mt-1">Click &quot;Add Date&quot; to create your first one.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Subtitle</TableHead>
                <TableHead>
                  <button
                    onClick={() => { playClick(); setSortBy(sortBy === "date" ? "order" : "date"); }}
                    className="flex items-center gap-1 hover:text-brand-blue transition-colors"
                    title={sortBy === "date" ? "Sorting by date — click for manual order" : "Sorting by manual order — click to sort by date"}
                  >
                    Date
                    <ArrowUpDown className={`w-3 h-3 ${sortBy === "date" ? "text-brand-blue" : "text-gray-400"}`} />
                  </button>
                </TableHead>
                <TableHead className="text-center">Recurring</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {sortedDates.map((item, idx) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="group border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <TableCell className="text-center text-xs text-brand-grey font-mono">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                        {item.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {item.subtitle || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDateDisplay(item.date)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {item.recurType === "monthly" ? (
                        <Badge variant="outline" className="text-[10px] border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 gap-0.5">
                          <RefreshCw className="w-2.5 h-2.5" />
                          Monthly
                        </Badge>
                      ) : item.recurType === "first_workday" ? (
                        <Badge variant="outline" className="text-[10px] border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 gap-0.5">
                          <RefreshCw className="w-2.5 h-2.5" />
                          1st Workday
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <button onClick={() => handleToggleActive(item)} title={item.active ? "Deactivate" : "Activate"}>
                        {item.active ? (
                          <ToggleRight className="w-6 h-6 text-green-500 hover:text-green-600 transition-colors mx-auto" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-gray-300 hover:text-gray-400 transition-colors mx-auto" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => handleReorder(dates.findIndex((d) => d.id === item.id), "up")}
                          disabled={sortBy === "date" || dates.findIndex((d) => d.id === item.id) === 0}
                          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-20 transition-colors"
                        >
                          <ArrowUp className="w-3.5 h-3.5 text-brand-grey" />
                        </button>
                        <button
                          onClick={() => handleReorder(dates.findIndex((d) => d.id === item.id), "down")}
                          disabled={sortBy === "date" || dates.findIndex((d) => d.id === item.id) === dates.length - 1}
                          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-20 transition-colors"
                        >
                          <ArrowDown className="w-3.5 h-3.5 text-brand-grey" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                          className="h-7 w-7 p-0 hover:text-brand-blue"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { playClick(); setDeletingId(item.id); }}
                          className="h-7 w-7 p-0 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-pink-500" />
              {editingDate ? "Edit Date" : "Add Important Date"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Label</label>
              <Input
                placeholder="e.g. Rate Lock Deadline"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Subtitle <span className="text-gray-400 font-normal">(optional)</span></label>
              <Input
                placeholder="e.g. Lock cutoff for the month"
                value={formSubtitle}
                onChange={(e) => setFormSubtitle(e.target.value)}
                maxLength={100}
              />
              <p className="text-[11px] text-brand-grey mt-1">Displays under the title on the dashboard widget</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Date</label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Recurrence</label>
                <select
                  value={formRecurType}
                  onChange={(e) => setFormRecurType(e.target.value)}
                  className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
                >
                  <option value="none">No Recurrence</option>
                  <option value="monthly">Recurring Monthly (same day)</option>
                  <option value="first_workday">First Workday of Month</option>
                </select>
                <p className="text-[11px] text-brand-grey mt-1">
                  {formRecurType === "monthly" && "Repeats on the same day each month"}
                  {formRecurType === "first_workday" && "1st of month, adjusted to Monday if it falls on a weekend"}
                  {formRecurType === "none" && "One-time date, no recurrence"}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formLabel.trim() || !formDate || saving}
              className="bg-brand-blue hover:bg-brand-blue/90 text-white gap-1.5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingDate ? "Save Changes" : "Add Date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open) { setImportDialogOpen(false); setImportPreview([]); setImportError(null); setImportResult(null); } }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              Import Important Dates
            </DialogTitle>
          </DialogHeader>

          {importResult ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Successfully imported {importResult.imported} date{importResult.imported !== 1 ? "s" : ""}!
              </p>
              <Button onClick={() => { setImportDialogOpen(false); setImportResult(null); }} className="bg-brand-blue hover:bg-brand-blue/90 text-white">
                Done
              </Button>
            </div>
          ) : importError && importPreview.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <p className="text-sm text-red-600 dark:text-red-400 text-center">{importError}</p>
              <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportError(null); }}>
                Close
              </Button>
            </div>
          ) : (
            <>
              {importError && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs rounded-md px-3 py-2">
                  {importError}
                </div>
              )}
              <div className="flex-1 overflow-auto">
                <p className="text-xs text-brand-grey mb-2">Preview — {importPreview.length} date{importPreview.length !== 1 ? "s" : ""} found:</p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">Note: Dates must be in <span className="font-mono font-semibold">YYYY-MM-DD</span> format (e.g. 2026-03-15)</p>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                        <TableHead className="text-xs">Label</TableHead>
                        <TableHead className="text-xs">Subtitle</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs text-center">Recurrence</TableHead>
                        <TableHead className="text-xs text-center">Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.map((row, i) => (
                        <TableRow key={i} className="text-xs">
                          <TableCell className="font-medium py-1.5">{row.label}</TableCell>
                          <TableCell className="py-1.5 text-gray-500">{row.subtitle || "—"}</TableCell>
                          <TableCell className="py-1.5">{row.date}</TableCell>
                          <TableCell className="text-center py-1.5">
                            {row.recurType === "monthly" ? (
                              <Badge variant="outline" className="text-[9px] border-purple-300 text-purple-600">Monthly</Badge>
                            ) : row.recurType === "first_workday" ? (
                              <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-600">1st Workday</Badge>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            {row.active ? (
                              <span className="text-green-600 font-medium">Yes</span>
                            ) : (
                              <span className="text-gray-400">No</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportPreview([]); }} disabled={importing}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImportConfirm}
                  disabled={importPreview.length === 0 || importing}
                  className="bg-brand-blue hover:bg-brand-blue/90 text-white gap-1.5"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Import {importPreview.length} Date{importPreview.length !== 1 ? "s" : ""}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Date?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-brand-grey">
            This will permanently remove this important date from the dashboard.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
