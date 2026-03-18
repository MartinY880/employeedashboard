// ProConnect — Admin Celebrations Page
// Manage Salesforce directory entries (birthdays/anniversaries) and exam pass records
// Data normally flows from Salesforce, but admins can CRUD for corrections.

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Search,
  Upload,
  Trash2,
  PartyPopper,
  X,
  Cake,
  CalendarHeart,
  GraduationCap,
  Pencil,
  Check,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface DirectoryUser {
  id: string;
  displayName: string;
  mail: string | null;
  jobTitle: string | null;
  department: string | null;
}

interface SalesforceEntry {
  id: string;
  email: string;
  birthday: string | null;
  employmentStartDate: string | null;
  syncedAt: string;
  examPassRecord: ExamRecord | null;
}

interface ExamRecord {
  id: string;
  email: string;
  employeeName: string;
  createdAt: string;
}

type Tab = "directory" | "exams";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function AdminCelebrationsPage() {
  const [tab, setTab] = useState<Tab>("directory");
  const [directory, setDirectory] = useState<SalesforceEntry[]>([]);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [employees, setEmployees] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);

  // CSV upload state
  const [dirCsvImporting, setDirCsvImporting] = useState(false);
  const [dirCsvResult, setDirCsvResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [examCsvImporting, setExamCsvImporting] = useState(false);
  const [examCsvResult, setExamCsvResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const dirFileRef = useRef<HTMLInputElement>(null);
  const examFileRef = useRef<HTMLInputElement>(null);

  // Widget visibility
  const [widgetVisible, setWidgetVisible] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Table search filters
  const [dirTableSearch, setDirTableSearch] = useState("");
  const [examTableSearch, setExamTableSearch] = useState("");

  // "Missing from Entra" filter toggles
  const [dirMissingFilter, setDirMissingFilter] = useState(false);
  const [examMissingFilter, setExamMissingFilter] = useState(false);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBirthday, setEditBirthday] = useState("");
  const [editStartDate, setEditStartDate] = useState("");

  // Fetch data (celebrations + company snapshot employees in one call)
  useEffect(() => {
    fetch("/api/celebrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list" }),
    })
      .then((r) => r.json())
      .then((d) => {
        setDirectory(d.directory || []);
        setExams(d.exams || []);
        setEmployees(d.employees || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Fetch current visibility
    fetch("/api/dashboard-settings/visibility")
      .then((r) => r.json())
      .then((d) => setWidgetVisible(d.showCelebrations !== false))
      .catch(() => {});
  }, []);

  const toggleVisibility = async () => {
    setToggling(true);
    const newValue = !widgetVisible;
    try {
      const res = await fetch("/api/dashboard-settings/visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showCelebrations: newValue }),
      });
      if (!res.ok) throw new Error("Failed");
      setWidgetVisible(newValue);
      toast.success(newValue ? "Widget visible on dashboard" : "Widget hidden from dashboard");
    } catch {
      toast.error("Failed to update visibility");
    } finally {
      setToggling(false);
    }
  };

  // CSV import: directory entries
  const handleDirCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDirCsvImporting(true);
    setDirCsvResult(null);
    try {
      const csvText = await file.text();
      const res = await fetch("/api/celebrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "importDirectory", csvText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setDirCsvResult({ imported: data.imported, errors: data.errors || [] });
      if (data.directory) setDirectory(data.directory.map((d: SalesforceEntry) => ({ ...d, examPassRecord: d.examPassRecord ?? null })));
      toast.success(`Imported ${data.imported} directory entries`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CSV import failed");
    } finally {
      setDirCsvImporting(false);
      if (dirFileRef.current) dirFileRef.current.value = "";
    }
  };

  // CSV import: exam records
  const handleExamCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExamCsvImporting(true);
    setExamCsvResult(null);
    try {
      const csvText = await file.text();
      const res = await fetch("/api/celebrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "importExams", csvText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setExamCsvResult({ imported: data.imported, errors: data.errors || [] });
      if (data.exams) setExams(data.exams);
      toast.success(`Imported ${data.imported} exam records`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CSV import failed");
    } finally {
      setExamCsvImporting(false);
      if (examFileRef.current) examFileRef.current.value = "";
    }
  };

  const handleDeleteDirectory = async (id: string) => {
    try {
      const res = await fetch(`/api/celebrations?type=directory&id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      setDirectory((prev) => prev.filter((d) => d.id !== id));
      // Also remove any associated exam record from local state
      const entry = directory.find((d) => d.id === id);
      if (entry) {
        setExams((prev) => prev.filter((e) => e.email !== entry.email));
      }
      toast.success("Entry removed.");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const handleDeleteExam = async (id: string) => {
    try {
      const res = await fetch(`/api/celebrations?type=exam&id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      setExams((prev) => prev.filter((e) => e.id !== id));
      toast.success("Exam record removed.");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const handleUpdateDirectory = async (id: string) => {
    try {
      const res = await fetch("/api/celebrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "directory",
          id,
          birthday: editBirthday || null,
          employmentStartDate: editStartDate || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setDirectory((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...data.record } : d))
      );
      setEditingId(null);
      toast.success("Entry updated.");
    } catch {
      toast.error("Failed to update.");
    }
  };

  const startEditing = (entry: SalesforceEntry) => {
    setEditingId(entry.id);
    setEditBirthday(
      entry.birthday ? new Date(entry.birthday).toISOString().split("T")[0] : ""
    );
    setEditStartDate(
      entry.employmentStartDate
        ? new Date(entry.employmentStartDate).toISOString().split("T")[0]
        : ""
    );
  };

  // Entra lookup helper (from company snapshot)
  const entraByEmail = useMemo(() => {
    const map = new Map<string, DirectoryUser>();
    for (const u of employees) {
      if (u.mail) map.set(u.mail.toLowerCase(), u);
    }
    return map;
  }, [employees]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-brand-grey hover:text-brand-blue transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <PartyPopper className="h-6 w-6 text-brand-blue" />
            Celebrations Management
          </h1>
          <Button
            onClick={toggleVisibility}
            disabled={toggling}
            variant="outline"
            className={widgetVisible
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
              : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            }
          >
            {widgetVisible ? <Eye className="h-4 w-4 mr-1.5" /> : <EyeOff className="h-4 w-4 mr-1.5" />}
            {widgetVisible ? "Visible" : "Hidden"}
          </Button>
        </div>
        <p className="text-sm text-brand-grey mt-1">
          Manage Salesforce directory entries (birthdays &amp; anniversaries) and exam
          pass records. Data syncs from Salesforce automatically — use this page for corrections.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([
          { key: "directory" as Tab, label: "Directory", icon: CalendarHeart, count: directory.length },
          { key: "exams" as Tab, label: "Exam Records", icon: GraduationCap, count: exams.length },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
              tab === t.key
                ? "bg-brand-blue text-white border-brand-blue"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                tab === t.key
                  ? "bg-white/20 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-500"
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Directory Tab ─────────────────────────────────── */}
      {tab === "directory" && (
        <>
          {/* CSV Import */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-1">
              Import from CSV
            </h2>
            <p className="text-xs text-brand-grey mb-4">
              Upload a CSV exported from Salesforce. Required column: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-[11px]">email</code>. Optional:
              <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-[11px] ml-1">birthday</code>,
              <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-[11px] ml-1">employment_start_date</code> (or hire_date).
              Existing entries with the same email will be updated.
            </p>
            <div className="flex items-center gap-3">
              <input
                ref={dirFileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleDirCsvUpload}
                className="hidden"
              />
              <Button
                onClick={() => dirFileRef.current?.click()}
                disabled={dirCsvImporting}
                className="bg-brand-blue hover:bg-brand-blue/90 text-white gap-2"
              >
                {dirCsvImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {dirCsvImporting ? "Importing…" : "Upload CSV"}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  const csv = "email,employee_name,birthday,employment_start_date\n";
                  const blob = new Blob([csv], { type: "text/csv" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "directory_template.csv";
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
              >
                <Download className="h-4 w-4" />
                Export CSV Template
              </Button>
              {dirCsvResult && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">{dirCsvResult.imported} imported</span>
                  {dirCsvResult.errors.length > 0 && (
                    <span className="text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {dirCsvResult.errors.join(", ")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Directory List */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                Salesforce Directory ({directory.length})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDirMissingFilter((p) => !p)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    dirMissingFilter
                      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                      : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Missing Name
                </button>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={dirTableSearch}
                    onChange={(e) => setDirTableSearch(e.target.value)}
                    placeholder="Filter by name or email…"
                    className="pl-9 h-8 text-xs"
                  />
                  {dirTableSearch && (
                    <button onClick={() => setDirTableSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-brand-grey py-8 text-center">Loading…</p>
            ) : directory.length === 0 ? (
              <p className="text-sm text-brand-grey py-8 text-center">
                No directory entries yet.
              </p>
            ) : (
              <div className="space-y-2">
                {directory.filter((entry) => {
                  const entra = entraByEmail.get(entry.email.toLowerCase());
                  // "Missing Name" filter: show only entries with no Entra match
                  if (dirMissingFilter && entra) return false;
                  if (!dirTableSearch.trim()) return true;
                  const q = dirTableSearch.toLowerCase();
                  return (
                    entry.email.toLowerCase().includes(q) ||
                    (entra?.displayName ?? "").toLowerCase().includes(q)
                  );
                }).map((entry) => {
                  const entra = entraByEmail.get(entry.email.toLowerCase());
                  const isEditing = editingId === entry.id;

                  return (
                    <motion.div
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage
                          src={
                            entra
                              ? `/api/directory/photo?userId=${encodeURIComponent(entra.id)}&name=${encodeURIComponent(entra.displayName)}&size=120x120`
                              : undefined
                          }
                        />
                        <AvatarFallback className="text-xs bg-brand-blue text-white">
                          {getInitials(entra?.displayName ?? entry.email)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {entra?.displayName ?? entry.email}
                        </p>
                        <p className="text-xs text-brand-grey truncate">
                          {entry.email}
                        </p>
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <div>
                            <span className="text-[10px] text-brand-grey">Birthday</span>
                            <Input
                              type="date"
                              value={editBirthday}
                              onChange={(e) => setEditBirthday(e.target.value)}
                              className="h-8 text-xs w-32"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-brand-grey">Start Date</span>
                            <Input
                              type="date"
                              value={editStartDate}
                              onChange={(e) => setEditStartDate(e.target.value)}
                              className="h-8 text-xs w-32"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateDirectory(entry.id)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1.5 text-xs text-brand-grey">
                            <Cake className="h-3.5 w-3.5 text-pink-500" />
                            {formatDate(entry.birthday)}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-brand-grey">
                            <CalendarHeart className="h-3.5 w-3.5 text-emerald-500" />
                            {formatDate(entry.employmentStartDate)}
                          </div>
                          {entry.examPassRecord && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                              Exam ✓
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(entry)}
                            className="text-brand-grey hover:text-brand-blue"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDirectory(entry.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Exams Tab ─────────────────────────────────────── */}
      {tab === "exams" && (
        <>
          {/* CSV Import */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-1">
              Import from CSV
            </h2>
            <p className="text-xs text-brand-grey mb-4">
              Upload a CSV exported from Salesforce. Required column: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-[11px]">email</code>. Optional:
              <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-[11px] ml-1">employee_name</code> (or name).
              Existing records with the same email will be updated.
            </p>
            <div className="flex items-center gap-3">
              <input
                ref={examFileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleExamCsvUpload}
                className="hidden"
              />
              <Button
                onClick={() => examFileRef.current?.click()}
                disabled={examCsvImporting}
                className="bg-brand-blue hover:bg-brand-blue/90 text-white gap-2"
              >
                {examCsvImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {examCsvImporting ? "Importing…" : "Upload CSV"}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  const csv = "email,employee_name\n";
                  const blob = new Blob([csv], { type: "text/csv" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "exams_template.csv";
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
              >
                <Download className="h-4 w-4" />
                Export CSV Template
              </Button>
              {examCsvResult && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">{examCsvResult.imported} imported</span>
                  {examCsvResult.errors.length > 0 && (
                    <span className="text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {examCsvResult.errors.join(", ")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Exam List */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                Exam Pass Records ({exams.length})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExamMissingFilter((p) => !p)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    examMissingFilter
                      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                      : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Missing Name
                </button>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={examTableSearch}
                    onChange={(e) => setExamTableSearch(e.target.value)}
                    placeholder="Filter by name or email…"
                    className="pl-9 h-8 text-xs"
                  />
                  {examTableSearch && (
                    <button onClick={() => setExamTableSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-brand-grey mb-4">
              Records older than 30 days are automatically cleaned up daily at midnight EST.
            </p>

            {loading ? (
              <p className="text-sm text-brand-grey py-8 text-center">Loading…</p>
            ) : exams.length === 0 ? (
              <p className="text-sm text-brand-grey py-8 text-center">
                No exam pass records.
              </p>
            ) : (
              <div className="space-y-2">
                {exams.filter((exam) => {
                  const entra = entraByEmail.get(exam.email.toLowerCase());
                  // "Missing Name" filter: show only entries with no Entra match
                  if (examMissingFilter && entra) return false;
                  if (!examTableSearch.trim()) return true;
                  const q = examTableSearch.toLowerCase();
                  return (
                    exam.email.toLowerCase().includes(q) ||
                    exam.employeeName.toLowerCase().includes(q) ||
                    (entra?.displayName ?? "").toLowerCase().includes(q)
                  );
                }).map((exam) => {
                  const entra = entraByEmail.get(exam.email.toLowerCase());
                  const daysAgo = Math.floor(
                    (Date.now() - new Date(exam.createdAt).getTime()) /
                      (1000 * 60 * 60 * 24)
                  );

                  return (
                    <motion.div
                      key={exam.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"
                    >
                      <div className="w-1 h-10 rounded-full shrink-0 bg-amber-500" />
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage
                          src={
                            entra
                              ? `/api/directory/photo?userId=${encodeURIComponent(entra.id)}&name=${encodeURIComponent(entra.displayName)}&size=120x120`
                              : undefined
                          }
                        />
                        <AvatarFallback className="text-xs bg-amber-500 text-white">
                          {getInitials(entra?.displayName ?? exam.employeeName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {entra?.displayName ?? exam.employeeName}
                        </p>
                        <p className="text-xs text-brand-grey truncate">
                          {exam.email}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-xs text-brand-grey">
                          <GraduationCap className="h-3.5 w-3.5 inline mr-1 text-amber-500" />
                          {formatDate(exam.createdAt)}
                          <span className="ml-1 text-[10px] text-gray-400">
                            ({daysAgo}d ago)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteExam(exam.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
