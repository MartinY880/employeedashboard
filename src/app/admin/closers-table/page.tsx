// ProConnect — Admin Closers Table Page
// Search directory for employees, assign awards, manage the awards banner

"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Search,
  Plus,
  Trash2,
  Trophy,
  X,
  GripVertical,
  Lock,
  Loader2,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import type { ClosersTableSfSource, ClosersTableSfConfig, ClosersTableSfRank } from "@/lib/closers-table-sync";

interface DirectoryUser {
  id: string;
  displayName: string;
  mail: string | null;
  jobTitle: string | null;
  department: string | null;
  photoUrl?: string;
  directReports?: DirectoryUser[];
}

interface CloserAward {
  id: string;
  employeeId: string | null;
  employeeName: string;
  award: string;
  color: string;
  awardFontSize: number;
  sortOrder: number;
  active: boolean;
}

interface ColumnInfo {
  name: string;
  label: string;
  dataType: string;
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

function flattenTree(nodes: DirectoryUser[]): DirectoryUser[] {
  const flat: DirectoryUser[] = [];
  for (const n of nodes) {
    flat.push(n);
    if (n.directReports?.length) flat.push(...flattenTree(n.directReports));
  }
  return flat;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function AdminClosersTablePage() {
  const [awards, setAwards] = useState<CloserAward[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [dirLoading, setDirLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);
  const [awardText, setAwardText] = useState("");
  const [awardColor, setAwardColor] = useState("#f59e0b");
  const [awardFontSize, setAwardFontSize] = useState(10);
  const [showResults, setShowResults] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const autoFetchedRef = useRef<Set<string>>(new Set());

  // SF Auto-Sync state
  const [sfEnabled, setSfEnabled] = useState(false);
  const [sfRefreshMinutes, setSfRefreshMinutes] = useState(15);
  const [sfSources, setSfSources] = useState<ClosersTableSfSource[]>([]);
  const [sfLastSyncedAt, setSfLastSyncedAt] = useState<string | null>(null);
  const [sfSaving, setSfSaving] = useState(false);
  const [syncPaused, setSyncPaused] = useState(false);
  const [pauseToggling, setPauseToggling] = useState(false);
  const [sfError, setSfError] = useState("");
  const [sourceColumns, setSourceColumns] = useState<Record<string, ColumnInfo[]>>({});
  const [describingSource, setDescribingSource] = useState<string | null>(null);
  const [freezeInfo, setFreezeInfo] = useState<{
    lastDayToClose: string;
    frozen: boolean;
    resumesOn?: string;
  } | null>(null);
  const [statusChecking, setStatusChecking] = useState(false);
  const [statusResult, setStatusResult] = useState<{
    awardsCount: number;
    frozen: boolean;
    lastDayToClose: string | null;
  } | null>(null);

  const handleTogglePause = useCallback(async () => {
    setPauseToggling(true);
    try {
      const res = await fetch("/api/closers-table/sf-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncPaused: !syncPaused }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setSyncPaused((v) => !v);
      toast.success(!syncPaused ? "Sync paused." : "Sync resumed.");
    } catch {
      toast.error("Failed to toggle sync pause.");
    } finally {
      setPauseToggling(false);
    }
  }, [syncPaused]);

  const handleCheckStatus = useCallback(async () => {
    setStatusChecking(true);
    setStatusResult(null);
    try {
      const res = await fetch("/api/closers-table", { cache: "no-store" });
      const data = await res.json();
      setStatusResult({
        awardsCount: (data.awards ?? []).length,
        frozen: data.freezeInfo?.frozen ?? false,
        lastDayToClose: data.freezeInfo?.lastDayToClose ?? null,
      });
      if (data.freezeInfo) setFreezeInfo(data.freezeInfo);
      // Refresh lastSyncedAt from config too
      const cfgRes = await fetch("/api/closers-table/sf-config");
      const cfgData = await cfgRes.json();
      if (cfgData?.config?.lastSyncedAt) setSfLastSyncedAt(cfgData.config.lastSyncedAt);
    } catch {
      // silent
    } finally {
      setStatusChecking(false);
    }
  }, []);

  // Fetch awards
  useEffect(() => {
    fetch("/api/closers-table")
      .then((r) => r.json())
      .then((d) => {
        setAwards(d.awards || []);
        if (d.freezeInfo) setFreezeInfo(d.freezeInfo);
      })
      .catch(() => {});
  }, []);

  // Fetch directory
  useEffect(() => {
    fetch("/api/directory?mode=tree")
      .then((r) => r.json())
      .then((d) => {
        setDirectoryUsers(d.users || []);
        setDirLoading(false);
      })
      .catch(() => setDirLoading(false));
  }, []);

  // Load SF sync config
  useEffect(() => {
    fetch("/api/closers-table/sf-config")
      .then((r) => r.json())
      .then((d) => {
        if (d?.config) {
          const c = d.config as ClosersTableSfConfig;
          setSfEnabled(c.enabled ?? false);
          setSfRefreshMinutes(c.refreshMinutes ?? 15);
          // Normalize sources: migrate old format (awardTitle/color) → per-rank format
          setSfSources(
            (c.sources ?? []).map((s) => ({
              ...s,
              awardFontSize: s.awardFontSize ?? 10,
              ranks: s.ranks?.length
                ? s.ranks
                : [{ awardTitle: (s as unknown as Record<string, string>).awardTitle ?? "#1 Closer", color: (s as unknown as Record<string, string>).color ?? "#f59e0b" }],
            }))
          );
          setSfLastSyncedAt(c.lastSyncedAt ?? null);
          setSyncPaused(c.syncPaused ?? false);
        }
      })
      .catch(() => {});
  }, []);

  const flatUsers = useMemo(() => flattenTree(directoryUsers), [directoryUsers]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return flatUsers
      .filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          (u.jobTitle && u.jobTitle.toLowerCase().includes(q)) ||
          (u.department && u.department.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [flatUsers, searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelectUser = (user: DirectoryUser) => {
    setSelectedUser(user);
    setSearchQuery(user.displayName);
    setShowResults(false);
  };

  const handleAddAward = async () => {
    if (!selectedUser || !awardText.trim()) {
      toast.error("Select an employee and enter an award.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/closers-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedUser.id,
          employeeName: selectedUser.displayName,
          award: awardText.trim(),
          color: awardColor,
          awardFontSize,
        }),
      });

      if (!res.ok) throw new Error("Failed to create");
      const data = await res.json();
      setAwards((prev) => [...prev, data.award]);
      setSelectedUser(null);
      setSearchQuery("");
      setAwardText("");
      setAwardColor("#f59e0b");
      setAwardFontSize(10);
      toast.success(`Added ${data.award.employeeName} to Closers Table!`);
    } catch {
      toast.error("Failed to add award.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAward = async (id: string) => {
    try {
      const res = await fetch(`/api/closers-table?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setAwards((prev) => prev.filter((a) => a.id !== id));
      toast.success("Award removed.");
    } catch {
      toast.error("Failed to delete award.");
    }
  };

  const sortedAwards = useMemo(
    () => [...awards].sort((a, b) => a.sortOrder - b.sortOrder),
    [awards]
  );

  const handleReorderAward = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sortedAwards.length) return;

    const itemA = sortedAwards[index];
    const itemB = sortedAwards[swapIndex];
    const orderA = itemA.sortOrder;
    const orderB = itemB.sortOrder;

    setAwards((prev) =>
      prev.map((a) => {
        if (a.id === itemA.id) return { ...a, sortOrder: orderB };
        if (a.id === itemB.id) return { ...a, sortOrder: orderA };
        return a;
      })
    );

    try {
      await Promise.all([
        fetch("/api/closers-table", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: itemA.id, sortOrder: orderB }),
        }),
        fetch("/api/closers-table", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: itemB.id, sortOrder: orderA }),
        }),
      ]);
    } catch {
      toast.error("Failed to reorder.");
      setAwards((prev) =>
        prev.map((a) => {
          if (a.id === itemA.id) return { ...a, sortOrder: orderA };
          if (a.id === itemB.id) return { ...a, sortOrder: orderB };
          return a;
        })
      );
    }
  };

  const handleUpdateAward = async (id: string, updates: Partial<CloserAward>) => {
    try {
      const res = await fetch("/api/closers-table", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      setAwards((prev) => prev.map((a) => (a.id === id ? { ...a, ...data.award } : a)));
    } catch {
      toast.error("Failed to update award.");
    }
  };

  const handleAddSource = useCallback(() => {
    setSfSources((prev) => [
      ...prev,
      {
        id: `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
        reportUrl: "",
        reportId: "",
        reportName: "",
        nameColumn: "",
        emailColumn: "",
        userIdColumn: "",
        take: 1,
        awardFontSize: 10,
        ranks: [{ awardTitle: "#1 Closer", color: "#f59e0b" }],
      },
    ]);
  }, []);

  const handleDescribeSource = useCallback(async (sourceId: string, reportUrl: string) => {
    if (!reportUrl.trim()) return;
    setDescribingSource(sourceId);
    try {
      const res = await fetch("/api/closers-table/sf-config/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to describe report");
      setSourceColumns((prev) => ({ ...prev, [sourceId]: data.columns ?? [] }));
      setSfSources((prev) =>
        prev.map((s) =>
          s.id === sourceId
            ? { ...s, reportId: data.reportId, reportName: data.reportName }
            : s,
        ),
      );
      toast.success(`Found: "${data.reportName}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to describe report");
    } finally {
      setDescribingSource(null);
    }
  }, []);

  // Auto-fetch columns for sources that already have a reportUrl (e.g. after page refresh)
  useEffect(() => {
    sfSources.forEach((source) => {
      if (source.reportUrl && !autoFetchedRef.current.has(source.id)) {
        autoFetchedRef.current.add(source.id);
        handleDescribeSource(source.id, source.reportUrl);
      }
    });
  }, [sfSources, handleDescribeSource]);

  const handleSaveAndSync = useCallback(async () => {
    setSfSaving(true);
    setSfError("");
    try {
      const saveRes = await fetch("/api/closers-table/sf-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: sfEnabled, refreshMinutes: sfRefreshMinutes, sources: sfSources }),
      });
      if (!saveRes.ok) {
        const d = await saveRes.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || "Failed to save");
      }
      if (sfEnabled && sfSources.length > 0) {
        const syncRes = await fetch("/api/closers-table/sf-config/refresh", { method: "POST" });
        const data = await syncRes.json();
        if (!syncRes.ok) throw new Error((data as { error?: string }).error || "Sync failed");
        setSfLastSyncedAt((data as { syncedAt: string }).syncedAt);
        toast.success(`Saved & synced ${(data as { totalAwards: number }).totalAwards} closer${(data as { totalAwards: number }).totalAwards !== 1 ? "s" : ""} from Salesforce.`);
        const awardsRes = await fetch("/api/closers-table", { cache: "no-store" });
        const awardsData = await awardsRes.json();
        setAwards((awardsData as { awards: CloserAward[] }).awards || []);
      } else {
        toast.success("Config saved.");
      }
    } catch (err) {
      setSfError(err instanceof Error ? err.message : "Failed to save or sync");
    } finally {
      setSfSaving(false);
    }
  }, [sfEnabled, sfRefreshMinutes, sfSources]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-brand-grey hover:text-brand-blue transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-500" />
          Closers Table Awards
        </h1>
        <p className="text-sm text-brand-grey mt-1">
          Recognize top closers — search by name from the company directory, assign an award, and they&apos;ll appear on the dashboard banner.
        </p>
      </div>

      {/* Salesforce Auto-Sync */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              Salesforce Auto-Sync
            </h2>
            <p className="text-xs text-brand-grey mt-1">
              Pull top closers from SF reports and auto-update the banner every {sfRefreshMinutes} min.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={sfEnabled}
            onClick={() => setSfEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              sfEnabled ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
            }`}
            title={sfEnabled ? "SF sync enabled" : "SF sync disabled"}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                sfEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Refresh interval */}
        <div className="flex items-center gap-3 mb-5">
          <label className="text-xs font-medium text-brand-grey whitespace-nowrap">Refresh every</label>
          <input
            type="number"
            min={5}
            max={120}
            value={sfRefreshMinutes}
            onChange={(e) => setSfRefreshMinutes(Math.max(5, Number(e.target.value)))}
            className="w-20 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
          <span className="text-xs text-brand-grey">minutes</span>
        </div>

        {/* Sources */}
        <div className="space-y-4">
          {sfSources.map((source, idx) => (
            <SfSourceCard
              key={source.id}
              source={source}
              index={idx}
              columns={sourceColumns[source.id] ?? []}
              describing={describingSource === source.id}
              onUpdate={(updates) =>
                setSfSources((prev) =>
                  prev.map((s) => (s.id === source.id ? { ...s, ...updates } : s)),
                )
              }
              onDescribe={() => handleDescribeSource(source.id, source.reportUrl)}
              onDelete={() => setSfSources((prev) => prev.filter((s) => s.id !== source.id))}
            />
          ))}
        </div>

        {sfSources.length === 0 && (
          <p className="text-xs text-brand-grey py-6 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
            No report sources yet. Add one below.
          </p>
        )}

        <button
          type="button"
          onClick={handleAddSource}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Report Source
        </button>

        {/* Freeze status */}
        {freezeInfo && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-brand-grey">
              Last Day To Close:{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {new Date(freezeInfo.lastDayToClose + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </span>
            {freezeInfo.frozen && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                <Lock className="h-3 w-3" />
                {syncPaused ? "Manually paused" : "Syncing paused — resumes "}
                {!syncPaused && new Date(freezeInfo.resumesOn! + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        )}

        {/* Live status checker */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCheckStatus}
              disabled={statusChecking}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:text-brand-blue/80 disabled:opacity-50 transition-colors"
            >
              {statusChecking
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
              {statusChecking ? "Checking…" : "Check Live Status"}
            </button>
            {statusResult && !statusChecking && (
              <div className="flex items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                  statusResult.frozen
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                }`}>
                  {statusResult.frozen ? "Frozen" : "Active"}
                </span>
                <span className="text-brand-grey">
                  {statusResult.awardsCount} award{statusResult.awardsCount !== 1 ? "s" : ""} in DB
                </span>
                {statusResult.lastDayToClose && (
                  <span className="text-brand-grey">
                    · closes {new Date(statusResult.lastDayToClose + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button
            onClick={handleSaveAndSync}
            disabled={sfSaving}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {sfSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            {sfSaving ? "Saving…" : sfEnabled && sfSources.length > 0 ? "Save & Sync" : "Save Config"}
          </Button>
          <Button
            onClick={handleTogglePause}
            disabled={pauseToggling}
            variant="outline"
            className={syncPaused
              ? "border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
              : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}
          >
            {pauseToggling
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : syncPaused
                ? <RefreshCw className="h-4 w-4 mr-1" />
                : <Lock className="h-4 w-4 mr-1" />}
            {syncPaused ? "Resume Sync" : "Pause Sync"}
          </Button>
          {sfLastSyncedAt && (
            <span className={`text-xs ml-auto ${freezeInfo?.frozen ? "text-amber-600 dark:text-amber-400" : "text-brand-grey"}`}>
              {freezeInfo?.frozen ? "Frozen · last synced " : "Last synced: "}
              {formatRelativeTime(sfLastSyncedAt)}
            </span>
          )}
        </div>
        {sfError && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">{sfError}</p>
        )}
      </div>

      {/* Add Award Form */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-8">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-4">
          Add Award (Manual)
        </h2>
        {sfEnabled && sfSources.length > 0 && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <Zap className="h-4 w-4 text-orange-500 shrink-0" />
            <p className="text-xs text-orange-800 dark:text-orange-300">
              Salesforce Auto-Sync is active — manual entries will be replaced on the next sync.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Directory search */}
          <div ref={searchRef} className="relative">
            <label className="block text-xs font-medium text-brand-grey mb-1">
              Employee
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedUser(null);
                  setShowResults(true);
                }}
                onFocus={() => searchQuery.trim() && setShowResults(true)}
                placeholder={dirLoading ? "Loading directory…" : "Search by name…"}
                className="pl-10"
              />
              {selectedUser && (
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchQuery("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Results dropdown */}
            <AnimatePresence>
              {showResults && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                >
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={`/api/directory/photo?userId=${encodeURIComponent(user.id)}&name=${encodeURIComponent(user.displayName)}&size=96x96`}
                        />
                        <AvatarFallback className="text-xs bg-brand-blue text-white">
                          {getInitials(user.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {user.displayName}
                        </p>
                        <p className="text-xs text-brand-grey truncate">
                          {user.jobTitle || user.department || ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Award text */}
          <div>
            <label className="block text-xs font-medium text-brand-grey mb-1">
              Award
            </label>
            <Input
              value={awardText}
              onChange={(e) => setAwardText(e.target.value)}
              placeholder="e.g. Top Closer – March 2026"
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-medium text-brand-grey mb-1">
              Card Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={awardColor}
                onChange={(e) => setAwardColor(e.target.value)}
                className="h-9 w-12 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <Input
                value={awardColor}
                onChange={(e) => setAwardColor(e.target.value)}
                className="flex-1 font-mono text-sm"
                maxLength={7}
              />
            </div>
            <div className="flex gap-1.5 mt-2">
              {["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"].map((c) => (
                <button
                  key={c}
                  onClick={() => setAwardColor(c)}
                  className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: awardColor === c ? "white" : "transparent",
                    boxShadow: awardColor === c ? `0 0 0 2px ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Font size */}
          <div>
            <label className="block text-xs font-medium text-brand-grey mb-1">
              Award Text Size ({awardFontSize}px)
            </label>
            <input
              type="range"
              min={8}
              max={18}
              value={awardFontSize}
              onChange={(e) => setAwardFontSize(Number(e.target.value))}
              className="w-full accent-brand-blue"
            />
            <div className="flex justify-between text-[10px] text-brand-grey mt-0.5">
              <span>8px</span>
              <span>18px</span>
            </div>
          </div>
        </div>

        {/* Selected user preview */}
        {selectedUser && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={`/api/directory/photo?userId=${encodeURIComponent(selectedUser.id)}&name=${encodeURIComponent(selectedUser.displayName)}&size=120x120`}
              />
              <AvatarFallback className="text-xs bg-brand-blue text-white">
                {getInitials(selectedUser.displayName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {selectedUser.displayName}
              </p>
              <p className="text-xs text-brand-grey">
                {selectedUser.jobTitle}
                {selectedUser.department ? ` · ${selectedUser.department}` : ""}
              </p>
            </div>
          </div>
        )}

        <Button
          onClick={handleAddAward}
          disabled={!selectedUser || !awardText.trim() || saving}
          className="bg-brand-blue hover:bg-brand-blue/90 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          {saving ? "Adding…" : "Add to Closers Table"}
        </Button>
      </div>

      {/* Current Awards List */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-4">
          Current Awards ({awards.length})
        </h2>

        {awards.length === 0 ? (
          <p className="text-sm text-brand-grey py-8 text-center">
            No awards yet. Search for an employee above to add one.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedAwards.map((award, idx) => (
              <motion.div
                key={award.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"
              >
                {/* Sort order arrows */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => handleReorderAward(idx, "up")}
                    disabled={idx === 0}
                    className="p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleReorderAward(idx, "down")}
                    disabled={idx === sortedAwards.length - 1}
                    className="p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div
                  className="w-1 h-10 rounded-full shrink-0"
                  style={{ backgroundColor: award.color || "#f59e0b" }}
                />
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage
                    src={
                      award.employeeId
                        ? `/api/directory/photo?userId=${encodeURIComponent(award.employeeId)}&name=${encodeURIComponent(award.employeeName)}&size=120x120`
                        : undefined
                    }
                  />
                  <AvatarFallback className="text-xs bg-brand-blue text-white">
                    {getInitials(award.employeeName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {award.employeeName}
                  </p>
                  <p className="text-xs text-brand-grey truncate">
                    {award.award}
                  </p>
                </div>

                {/* Inline color edit */}
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="color"
                    value={award.color || "#f59e0b"}
                    onChange={(e) => handleUpdateAward(award.id, { color: e.target.value })}
                    className="h-7 w-7 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    title="Change color"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-brand-grey">{award.awardFontSize || 10}px</span>
                    <input
                      type="range"
                      min={8}
                      max={18}
                      value={award.awardFontSize || 10}
                      onChange={(e) => handleUpdateAward(award.id, { awardFontSize: Number(e.target.value) })}
                      className="w-16 accent-brand-blue"
                      title="Award text size"
                    />
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteAward(award.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SF Source Card ───────────────────────────────────────

function SfSourceCard({
  source,
  index,
  columns,
  describing,
  onUpdate,
  onDescribe,
  onDelete,
}: {
  source: ClosersTableSfSource;
  index: number;
  columns: ColumnInfo[];
  describing: boolean;
  onUpdate: (updates: Partial<ClosersTableSfSource>) => void;
  onDescribe: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Source {index + 1}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 h-7 w-7 p-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Report URL */}
      <div className="flex gap-2 mb-3">
        <Input
          value={source.reportUrl}
          onChange={(e) => onUpdate({ reportUrl: e.target.value })}
          placeholder="https://yourorg.lightning.force.com/lightning/r/Report/00O.../view"
          className="flex-1 text-xs font-mono"
        />
        <Button
          onClick={onDescribe}
          disabled={describing || !source.reportUrl.trim()}
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
        >
          {describing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Fetch Columns
        </Button>
      </div>

      {source.reportName && (
        <p className="text-[11px] text-brand-grey mb-3 font-mono">
          {source.reportName} · <span className="opacity-60">{source.reportId}</span>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[10px] font-semibold text-brand-grey uppercase tracking-wider mb-1">
            Name Column
          </label>
          <select
            value={source.nameColumn}
            onChange={(e) => onUpdate({ nameColumn: e.target.value })}
            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
          >
            <option value="">Select column…</option>
            {columns.map((c) => (
              <option key={c.name} value={c.name}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-brand-grey uppercase tracking-wider mb-1">
            Email Column
          </label>
          <select
            value={source.emailColumn}
            onChange={(e) => onUpdate({ emailColumn: e.target.value })}
            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
          >
            <option value="">Select column…</option>
            {columns.map((c) => (
              <option key={c.name} value={c.name}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-[10px] font-semibold text-brand-grey uppercase tracking-wider mb-1">
          SF User ID Column <span className="normal-case font-normal opacity-60">(optional — used to look up email when no email column)</span>
        </label>
        <select
          value={source.userIdColumn ?? ""}
          onChange={(e) => onUpdate({ userIdColumn: e.target.value })}
          className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
        >
          <option value="">None</option>
          {columns.map((c) => (
            <option key={c.name} value={c.name}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[10px] font-semibold text-brand-grey uppercase tracking-wider mb-1">
            Take Top {source.take} Record{source.take !== 1 ? "s" : ""}
          </label>
          <input
            type="range"
            min={1}
            max={5}
            value={source.take}
            onChange={(e) => {
              const newTake = Number(e.target.value);
              const DEFAULT_RANK_COLORS = ["#f59e0b", "#94a3b8", "#b45309", "#3b82f6", "#8b5cf6"];
              const curr = [...(source.ranks ?? [])];
              while (curr.length < newTake) {
                const i = curr.length;
                curr.push({ awardTitle: `#${i + 1} Closer`, color: DEFAULT_RANK_COLORS[i] ?? "#f59e0b" });
              }
              onUpdate({ take: newTake, ranks: curr.slice(0, newTake) });
            }}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-[10px] text-brand-grey mt-0.5">
            <span>1</span><span>5</span>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-brand-grey uppercase tracking-wider mb-1">
            Award Text Size ({source.awardFontSize}px)
          </label>
          <input
            type="range"
            min={8}
            max={18}
            value={source.awardFontSize}
            onChange={(e) => onUpdate({ awardFontSize: Number(e.target.value) })}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-[10px] text-brand-grey mt-0.5">
            <span>8px</span><span>18px</span>
          </div>
        </div>
      </div>

      {/* Per-rank title & color */}
      <div>
        <label className="block text-[10px] font-semibold text-brand-grey uppercase tracking-wider mb-2">
          Rank Titles &amp; Colors
        </label>
        <div className="space-y-2">
          {(source.ranks ?? []).map((rank, rankIdx) => (
            <div key={rankIdx} className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 shrink-0 w-5 text-right">
                #{rankIdx + 1}
              </span>
              <input
                type="color"
                value={rank.color}
                onChange={(e) => {
                  const newRanks = (source.ranks ?? []).map((r, i) =>
                    i === rankIdx ? { ...r, color: e.target.value } : r
                  );
                  onUpdate({ ranks: newRanks });
                }}
                className="h-7 w-9 rounded border border-gray-300 dark:border-gray-600 cursor-pointer shrink-0"
                title="Rank color"
              />
              <Input
                value={rank.awardTitle}
                onChange={(e) => {
                  const newRanks = (source.ranks ?? []).map((r, i) =>
                    i === rankIdx ? { ...r, awardTitle: e.target.value } : r
                  );
                  onUpdate({ ranks: newRanks });
                }}
                placeholder={`#${rankIdx + 1} Closer`}
                className="flex-1 text-xs"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
