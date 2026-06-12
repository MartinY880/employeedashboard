// ProConnect — Admin Directory Settings
// Configure root account and manage branches

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Loader2,
  Search,
  X,
  Users,
  Check,
  UserCheck,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useSounds } from "@/components/shared/SoundProvider";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface DirectoryConfig {
  rootUserId: string | null;
  rootEmail: string | null;
  rootName: string | null;
  sharedEmployeeTypes?: string[];
}

interface Branch {
  id: string;
  name: string;
  sortOrder: number;
  assignments: { userId: string }[];
}

interface SnapshotUser {
  id: string;
  displayName: string;
  jobTitle: string | null;
  department: string | null;
  mail: string | null;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function getPhotoUrl(userId: string, name: string) {
  return `/api/directory/photo?userId=${encodeURIComponent(userId)}&name=${encodeURIComponent(name)}&size=48x48`;
}

/* ------------------------------------------------------------------ */
/* Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function AdminDirectoryPage() {
  const { playClick } = useSounds();

  // Config
  const [config, setConfig] = useState<DirectoryConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [rootSearchQuery, setRootSearchQuery] = useState("");
  const [rootSearchResults, setRootSearchResults] = useState<SnapshotUser[]>([]);
  const [rootSearching, setRootSearching] = useState(false);
  const [rootDialogOpen, setRootDialogOpen] = useState(false);

  // Branches
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchName, setBranchName] = useState("");
  const [branchSaving, setBranchSaving] = useState(false);
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);

  // Shared employee types
  const [employeeTypes, setEmployeeTypes] = useState<string[]>([]);
  const [employeeTypesLoading, setEmployeeTypesLoading] = useState(true);
  const [sharedTypes, setSharedTypes] = useState<string[]>([]);
  const [sharedSaving, setSharedSaving] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState("");

  // Member assignment
  const [assignDialogBranch, setAssignDialogBranch] = useState<Branch | null>(null);
  const [directReports, setDirectReports] = useState<SnapshotUser[]>([]);
  const [directReportsLoading, setDirectReportsLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);

  /* ── Load config ── */
  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await fetch("/api/admin/directory/config");
      const data = await res.json();
      setConfig(data.config);
      setSharedTypes(data.config?.sharedEmployeeTypes ?? []);
    } catch {
      setConfig(null);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  /* ── Load distinct employee types ── */
  const loadEmployeeTypes = useCallback(async () => {
    setEmployeeTypesLoading(true);
    try {
      const res = await fetch("/api/admin/directory/employee-types");
      const data = await res.json();
      setEmployeeTypes(data.employeeTypes ?? []);
    } catch {
      setEmployeeTypes([]);
    } finally {
      setEmployeeTypesLoading(false);
    }
  }, []);

  /* ── Load branches ── */
  const loadBranches = useCallback(async () => {
    setBranchesLoading(true);
    try {
      const res = await fetch("/api/admin/directory/branches");
      const data = await res.json();
      setBranches(data.branches ?? []);
    } catch {
      setBranches([]);
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadBranches();
    void loadEmployeeTypes();
  }, [loadConfig, loadBranches, loadEmployeeTypes]);

  /* ── Toggle / save shared employee types ── */
  async function handleToggleSharedType(type: string) {
    playClick();
    const next = sharedTypes.includes(type)
      ? sharedTypes.filter((t) => t !== type)
      : [...sharedTypes, type];
    setSharedTypes(next); // optimistic
    setSharedSaving(true);
    try {
      const res = await fetch("/api/admin/directory/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedEmployeeTypes: next }),
      });
      const data = await res.json();
      setConfig(data.config);
      setSharedTypes(data.config?.sharedEmployeeTypes ?? next);
    } catch {
      // Revert on failure
      setSharedTypes(sharedTypes);
    } finally {
      setSharedSaving(false);
    }
  }

  /* ── Add custom employee type ── */
  async function handleAddCustomType() {
    const trimmed = customTypeInput.trim();
    if (!trimmed) return;
    playClick();
    setCustomTypeInput("");
    // Add to the known list if not already there
    if (!employeeTypes.includes(trimmed)) {
      setEmployeeTypes((prev) => [...prev, trimmed]);
    }
    // Mark it as shared immediately
    if (!sharedTypes.includes(trimmed)) {
      await handleToggleSharedType(trimmed);
    }
  }

  /* ── Root account search ── */
  useEffect(() => {
    if (rootSearchQuery.trim().length < 2) {
      setRootSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setRootSearching(true);
      try {
        const res = await fetch(`/api/directory?search=${encodeURIComponent(rootSearchQuery.trim())}`);
        const data = await res.json();
        setRootSearchResults(data.users ?? []);
      } catch {
        setRootSearchResults([]);
      } finally {
        setRootSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [rootSearchQuery]);

  /* ── Load direct reports of root for branch assignment ── */
  useEffect(() => {
    if (!assignDialogBranch || !config?.rootUserId) return;
    setDirectReportsLoading(true);
    // Dedicated admin endpoint — returns root's direct reports unfiltered by
    // job title/department (managing partners often have blank Entra titles).
    fetch(`/api/admin/directory/direct-reports`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setDirectReports(data.users ?? []);
      })
      .catch(() => setDirectReports([]))
      .finally(() => setDirectReportsLoading(false));
  }, [assignDialogBranch, config?.rootUserId]);

  /* ── Set root account ── */
  async function handleSetRoot(user: SnapshotUser) {
    playClick();
    try {
      const res = await fetch("/api/admin/directory/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootUserId: user.id, rootEmail: user.mail, rootName: user.displayName }),
      });
      const data = await res.json();
      setConfig(data.config);
      setRootDialogOpen(false);
      setRootSearchQuery("");
      setRootSearchResults([]);
    } catch {
      // ignore
    }
  }

  /* ── Save branch ── */
  async function handleSaveBranch() {
    if (!branchName.trim()) return;
    setBranchSaving(true);
    try {
      if (editingBranch) {
        const res = await fetch("/api/admin/directory/branches", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingBranch.id, name: branchName }),
        });
        const data = await res.json();
        setBranches((prev) => prev.map((b) => (b.id === editingBranch.id ? data.branch : b)));
      } else {
        const res = await fetch("/api/admin/directory/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: branchName }),
        });
        const data = await res.json();
        setBranches((prev) => [...prev, data.branch]);
      }
      setBranchDialogOpen(false);
      setBranchName("");
      setEditingBranch(null);
    } finally {
      setBranchSaving(false);
    }
  }

  /* ── Delete branch ── */
  async function handleDeleteBranch(id: string) {
    setDeletingBranchId(id);
    try {
      await fetch(`/api/admin/directory/branches?id=${id}`, { method: "DELETE" });
      setBranches((prev) => prev.filter((b) => b.id !== id));
    } finally {
      setDeletingBranchId(null);
    }
  }

  /* ── Reorder branch (move up / down) ── */
  const [reordering, setReordering] = useState(false);
  async function handleMoveBranch(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= branches.length || reordering) return;

    // Swap locally for instant feedback
    const next = [...branches];
    [next[index], next[target]] = [next[target], next[index]];
    const reSequenced = next.map((b, i) => ({ ...b, sortOrder: i }));
    setBranches(reSequenced);

    setReordering(true);
    try {
      await fetch("/api/admin/directory/branches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reSequenced.map((b) => ({ id: b.id, sortOrder: b.sortOrder }))),
      });
    } catch {
      // Reload from server on failure to resync
      void loadBranches();
    } finally {
      setReordering(false);
    }
  }

  /* ── Assign member to branch ── */
  async function handleAssignMember(branchId: string, userId: string) {
    setAssigningUserId(userId);
    try {
      const res = await fetch(`/api/admin/directory/branches/${branchId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setBranches((prev) => prev.map((b) => (b.id === branchId ? data.branch : b)));
      setAssignDialogBranch(data.branch);
    } finally {
      setAssigningUserId(null);
    }
  }

  /* ── Remove member from branch ── */
  async function handleRemoveMember(branchId: string, userId: string) {
    setAssigningUserId(userId);
    try {
      await fetch(`/api/admin/directory/branches/${branchId}/members?userId=${userId}`, { method: "DELETE" });
      setBranches((prev) =>
        prev.map((b) =>
          b.id === branchId
            ? { ...b, assignments: b.assignments.filter((a) => a.userId !== userId) }
            : b
        )
      );
      setAssignDialogBranch((prev) =>
        prev?.id === branchId
          ? { ...prev, assignments: prev.assignments.filter((a) => a.userId !== userId) }
          : prev
      );
    } finally {
      setAssigningUserId(null);
    }
  }

  // All assigned user IDs across all branches
  const allAssignedIds = new Set(branches.flatMap((b) => b.assignments.map((a) => a.userId)));

  const filteredDirectReports = directReports.filter((u) =>
    memberSearch.trim().length < 2 ||
    u.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
    (u.jobTitle ?? "").toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-5 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin" className="text-brand-grey hover:text-brand-blue transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Directory Settings</h1>
          <p className="text-sm text-brand-grey mt-0.5">Configure root account and branch groupings</p>
        </div>
      </div>

      {/* ── Root Account ── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Root Account
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { playClick(); setRootDialogOpen(true); }}
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            {config?.rootUserId ? "Change" : "Set Root Account"}
          </Button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          {configLoading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ) : config?.rootUserId ? (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={getPhotoUrl(config.rootUserId, config.rootName ?? "")} alt={config.rootName ?? ""} />
                <AvatarFallback className="bg-brand-blue text-white text-sm font-bold">
                  {getInitials(config.rootName ?? "R")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{config.rootName}</p>
                <p className="text-xs text-brand-grey">{config.rootEmail}</p>
              </div>
              <Badge variant="secondary" className="ml-auto text-[10px] bg-brand-blue/10 text-brand-blue">
                Root
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-brand-grey">No root account set. The org chart will use a synthetic root.</p>
          )}
        </div>
      </section>

      {/* ── Shared Employee Types ── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Shared Employee Types
          </h2>
          {sharedSaving && <Loader2 className="w-4 h-4 animate-spin text-brand-grey" />}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-brand-grey mb-3">
            Mark which employee types are &ldquo;Shared.&rdquo; Shared employees are excluded from
            branch grouping in the org chart — they don&rsquo;t appear under any one branch.
          </p>

          {/* Custom type input */}
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Type a custom employee type…"
              value={customTypeInput}
              onChange={(e) => setCustomTypeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustomType()}
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddCustomType}
              disabled={!customTypeInput.trim() || sharedSaving}
              className="h-8 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </div>

          {employeeTypesLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-full" />
              ))}
            </div>
          ) : employeeTypes.length === 0 ? (
            <p className="text-sm text-brand-grey">
              No employee types found in the directory yet. Type one above or sync the directory first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {employeeTypes.map((type) => {
                const isShared = sharedTypes.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => handleToggleSharedType(type)}
                    disabled={sharedSaving}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-60 ${
                      isShared
                        ? "bg-brand-blue text-white border-brand-blue"
                        : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-brand-blue/40"
                    }`}
                  >
                    {isShared && <Check className="w-3.5 h-3.5" />}
                    {type}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Branches ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Branches
          </h2>
          <Button
            size="sm"
            onClick={() => { playClick(); setEditingBranch(null); setBranchName(""); setBranchDialogOpen(true); }}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Branch
          </Button>
        </div>

        <div className="space-y-3">
          {branchesLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          ) : branches.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <GitBranch className="w-8 h-8 text-brand-grey/30 mx-auto mb-2" />
              <p className="text-sm text-brand-grey">No branches yet. Add one to start grouping the org chart.</p>
            </div>
          ) : (
            <AnimatePresence>
              {branches.map((branch, index) => (
                <motion.div
                  key={branch.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col -my-1">
                        <button
                          onClick={() => { playClick(); handleMoveBranch(index, -1); }}
                          disabled={index === 0 || reordering}
                          aria-label="Move branch up"
                          className="p-0.5 rounded text-gray-300 dark:text-gray-600 hover:text-brand-blue hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-300"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { playClick(); handleMoveBranch(index, 1); }}
                          disabled={index === branches.length - 1 || reordering}
                          aria-label="Move branch down"
                          className="p-0.5 rounded text-gray-300 dark:text-gray-600 hover:text-brand-blue hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-300"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{branch.name}</p>
                        <p className="text-xs text-brand-grey mt-0.5">
                          {branch.assignments.length} member{branch.assignments.length !== 1 ? "s" : ""} assigned
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          playClick();
                          setAssignDialogBranch(branch);
                          setMemberSearch("");
                        }}
                      >
                        <Users className="w-3.5 h-3.5 mr-1.5" />
                        Manage Members
                      </Button>
                      <button
                        onClick={() => {
                          playClick();
                          setEditingBranch(branch);
                          setBranchName(branch.name);
                          setBranchDialogOpen(true);
                        }}
                        className="p-1.5 rounded-md text-brand-grey hover:text-brand-blue hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { playClick(); handleDeleteBranch(branch.id); }}
                        disabled={deletingBranchId === branch.id}
                        className="p-1.5 rounded-md text-brand-grey hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40"
                      >
                        {deletingBranchId === branch.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </section>

      {/* ── Root Account Picker Dialog ── */}
      <Dialog open={rootDialogOpen} onOpenChange={(o) => { if (!o) { setRootDialogOpen(false); setRootSearchQuery(""); setRootSearchResults([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Root Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-brand-grey">
              Search for the account that all managing partners report to (e.g. mortgagepros@mtgpros.com).
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-grey" />
              <Input
                placeholder="Search by name or email…"
                value={rootSearchQuery}
                onChange={(e) => setRootSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
              {rootSearchQuery && (
                <button onClick={() => { setRootSearchQuery(""); setRootSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-brand-grey" />
                </button>
              )}
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {rootSearching && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-grey" />
                </div>
              )}
              {!rootSearching && rootSearchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSetRoot(u)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={getPhotoUrl(u.id, u.displayName)} alt={u.displayName} />
                    <AvatarFallback className="bg-brand-blue text-white text-xs font-bold">
                      {getInitials(u.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{u.displayName}</p>
                    <p className="text-xs text-brand-grey truncate">{u.mail}</p>
                  </div>
                  {config?.rootUserId === u.id && (
                    <Check className="w-4 h-4 text-brand-blue ml-auto shrink-0" />
                  )}
                </button>
              ))}
              {!rootSearching && rootSearchQuery.length >= 2 && rootSearchResults.length === 0 && (
                <p className="text-sm text-brand-grey text-center py-4">No results found</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit Branch Dialog ── */}
      <Dialog open={branchDialogOpen} onOpenChange={(o) => { if (!o) { setBranchDialogOpen(false); setBranchName(""); setEditingBranch(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingBranch ? "Rename Branch" : "Add Branch"}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Branch name (e.g. North Michigan)"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveBranch()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBranchDialogOpen(false); setBranchName(""); setEditingBranch(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveBranch} disabled={!branchName.trim() || branchSaving}>
              {branchSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {editingBranch ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manage Branch Members Dialog ── */}
      <Dialog open={!!assignDialogBranch} onOpenChange={(o) => { if (!o) { setAssignDialogBranch(null); setMemberSearch(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {assignDialogBranch?.name} — Members
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-brand-grey">
              Assign direct reports of the root account to this branch. Their entire subtree will inherit the branch.
            </p>

            {!config?.rootUserId && (
              <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                Set a root account first to see direct reports.
              </p>
            )}

            {config?.rootUserId && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-grey" />
                  <Input
                    placeholder="Filter by name or title…"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {directReportsLoading && (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-brand-grey" />
                    </div>
                  )}
                  {!directReportsLoading && filteredDirectReports.length === 0 && (
                    <p className="text-sm text-brand-grey text-center py-4">No direct reports found</p>
                  )}
                  {!directReportsLoading && filteredDirectReports.map((u) => {
                    const isInThisBranch = assignDialogBranch?.assignments.some((a) => a.userId === u.id);
                    const isInOtherBranch = !isInThisBranch && allAssignedIds.has(u.id);
                    const otherBranch = isInOtherBranch
                      ? branches.find((b) => b.assignments.some((a) => a.userId === u.id))
                      : null;
                    const isBusy = assigningUserId === u.id;

                    return (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={getPhotoUrl(u.id, u.displayName)} alt={u.displayName} />
                          <AvatarFallback className="bg-brand-blue text-white text-xs font-bold">
                            {getInitials(u.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{u.displayName}</p>
                          <p className="text-xs text-brand-grey truncate">{u.jobTitle || u.mail}</p>
                        </div>
                        {isInOtherBranch && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">{otherBranch?.name}</Badge>
                        )}
                        {isBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin text-brand-grey shrink-0" />
                        ) : isInThisBranch ? (
                          <button
                            onClick={() => handleRemoveMember(assignDialogBranch!.id, u.id)}
                            className="shrink-0 p-1.5 rounded-md text-brand-blue bg-brand-blue/10 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAssignMember(assignDialogBranch!.id, u.id)}
                            className="shrink-0 p-1.5 rounded-md text-brand-grey hover:text-brand-blue hover:bg-brand-blue/10 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Help Section */}
      <section className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
          Excluding Users from the Directory
        </h3>
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Excluding a user</p>
            <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5 list-decimal list-inside">
              <li>Go to Entra ID (Azure AD)</li>
              <li>Find the user you want to exclude</li>
              <li>Set their <span className="font-semibold">Office Location</span> field to "exclude"</li>
              <li>Run "Sync Directory" above to apply changes</li>
            </ol>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Marking a user as Shared</p>
            <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5 list-decimal list-inside">
              <li>Go to Entra ID (Azure AD)</li>
              <li>Find the user you want to mark as Shared</li>
              <li>Set their <span className="font-semibold">Employee Type</span> field to the desired value (e.g. "Shared")</li>
              <li>Run "Sync Directory" above — the employee type will appear as a chip above</li>
              <li>Check it off in the <span className="font-semibold">Shared Employee Types</span> section to apply the grouping</li>
            </ol>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Only set the Employee Type on the <span className="font-semibold">highest person</span> in that department — everyone who reports under them will automatically be marked as Shared as well.</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">You can also type a custom value directly into the Shared Employee Types field without changing Entra — useful for pre-configuring before a sync.</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 border-t border-blue-200 dark:border-blue-800 pt-3">
            The directory pulls from your organization's source of truth — no users are directly managed in ProConnect.
          </p>
        </div>
      </section>
    </div>
  );
}
