// ProConnect — Admin Role Mappings Page
// Manage job title → Logto role name mappings

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Loader2,
  Search,
  Info,
  UserX,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface RoleMappingItem {
  id: string;
  jobTitle: string;
  logtoRoleName: string;
  createdAt: string;
  updatedAt: string;
}

interface ExclusionItem {
  id: string;
  email: string;
  displayName: string;
  reason: string | null;
  createdAt: string;
}

interface DirectoryUser {
  displayName: string;
  mail: string | null;
  jobTitle: string | null;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AdminRoleMappingsPage() {
  const { playClick, playSuccess } = useSounds();
  const [mappings, setMappings] = useState<RoleMappingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<RoleMappingItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleMappingItem | null>(null);

  // Form state
  const [formJobTitle, setFormJobTitle] = useState("");
  const [formRoleName, setFormRoleName] = useState("");
  const [formError, setFormError] = useState("");

  // Exclusions state
  const [exclusions, setExclusions] = useState<ExclusionItem[]>([]);
  const [excludeSearch, setExcludeSearch] = useState("");
  const [excludeResults, setExcludeResults] = useState<DirectoryUser[]>([]);
  const [excludeSearching, setExcludeSearching] = useState(false);
  const [removeExcludeTarget, setRemoveExcludeTarget] = useState<ExclusionItem | null>(null);

  const fetchMappings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/role-mappings");
      const data = await res.json();
      setMappings(data.mappings || []);
    } catch {
      setMappings([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchExclusions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/role-mapping-exclusions");
      const data = await res.json();
      setExclusions(data.exclusions || []);
    } catch {
      setExclusions([]);
    }
  }, []);

  useEffect(() => {
    fetchMappings();
    fetchExclusions();
  }, [fetchMappings, fetchExclusions]);

  // Debounced directory search for exclusions
  useEffect(() => {
    if (excludeSearch.trim().length < 2) {
      setExcludeResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setExcludeSearching(true);
      try {
        const res = await fetch(
          `/api/admin/role-mapping-exclusions?search=${encodeURIComponent(excludeSearch.trim())}`,
        );
        const data = await res.json();
        setExcludeResults(data.users || []);
      } catch {
        setExcludeResults([]);
      } finally {
        setExcludeSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [excludeSearch]);

  async function handleAddExclusion(user: DirectoryUser) {
    if (!user.mail) return;
    playClick();
    try {
      const res = await fetch("/api/admin/role-mapping-exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.mail,
          displayName: user.displayName,
        }),
      });
      if (res.ok) {
        playSuccess();
        setExcludeSearch("");
        setExcludeResults([]);
        fetchExclusions();
      }
    } catch {
      // Error handled silently
    }
  }

  async function handleRemoveExclusion() {
    if (!removeExcludeTarget) return;
    playClick();
    try {
      await fetch(`/api/admin/role-mapping-exclusions?id=${removeExcludeTarget.id}`, {
        method: "DELETE",
      });
      playSuccess();
      setRemoveExcludeTarget(null);
      fetchExclusions();
    } catch {
      // Error handled silently
    }
  }

  function openCreateDialog() {
    playClick();
    setEditingMapping(null);
    setFormJobTitle("");
    setFormRoleName("");
    setFormError("");
    setDialogOpen(true);
  }

  function openEditDialog(mapping: RoleMappingItem) {
    playClick();
    setEditingMapping(mapping);
    setFormJobTitle(mapping.jobTitle);
    setFormRoleName(mapping.logtoRoleName);
    setFormError("");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formJobTitle.trim() || !formRoleName.trim()) {
      setFormError("Both fields are required");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      const res = editingMapping
        ? await fetch("/api/admin/role-mappings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: editingMapping.id,
              jobTitle: formJobTitle.trim(),
              logtoRoleName: formRoleName.trim(),
            }),
          })
        : await fetch("/api/admin/role-mappings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobTitle: formJobTitle.trim(),
              logtoRoleName: formRoleName.trim(),
            }),
          });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || "Failed to save");
        return;
      }

      playSuccess();
      setDialogOpen(false);
      fetchMappings();
    } catch {
      setFormError("Network error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    playClick();
    try {
      await fetch(`/api/admin/role-mappings?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      playSuccess();
      setDeleteTarget(null);
      fetchMappings();
    } catch {
      // Error handled silently
    }
  }

  // Filtered mappings
  const filtered = search
    ? mappings.filter(
        (m) =>
          m.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
          m.logtoRoleName.toLowerCase().includes(search.toLowerCase()),
      )
    : mappings;

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
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="rounded-lg">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500 text-white">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Role Mappings
            </h1>
            <p className="text-sm text-brand-grey">
              {mappings.length} mapping{mappings.length !== 1 ? "s" : ""} configured
            </p>
          </div>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-violet-500 hover:bg-violet-600 text-white gap-2"
        >
          <Plus className="w-4 h-4" /> New Mapping
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-800 p-4 text-sm text-violet-800 dark:text-violet-300">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">How role mappings work</p>
          <p className="mt-1 text-violet-600 dark:text-violet-400">
            When an employee logs in, their directory job title is checked against these
            mappings. If a match is found and their current Logto role is &ldquo;Employee&rdquo;,
            their role is automatically updated. Users with any other role are never
            touched. Users must log out and back in for changes to take effect.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by job title or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden bg-white dark:bg-gray-900">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[45%]">Job Title (Directory)</TableHead>
              <TableHead className="w-[35%]">Logto Role Name</TableHead>
              <TableHead className="w-[20%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-10 text-gray-400">
                  {search ? "No mappings match your search" : "No role mappings configured yet"}
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence>
                {filtered.map((mapping) => (
                  <motion.tr
                    key={mapping.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <TableCell className="font-medium">{mapping.jobTitle}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/40 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                        {mapping.logtoRoleName}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(mapping)}
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => { playClick(); setDeleteTarget(mapping); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMapping ? "Edit Role Mapping" : "New Role Mapping"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Job Title
              </label>
              <Input
                placeholder='e.g. "Loan Officer" or "Processor"'
                value={formJobTitle}
                onChange={(e) => setFormJobTitle(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Matched case-insensitively against the directory job title (exact match)
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Logto Role Name
              </label>
              <Input
                placeholder='e.g. "Sales" or "Processing" or "Admin"'
                value={formRoleName}
                onChange={(e) => setFormRoleName(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Must match an existing role name in Logto exactly
              </p>
            </div>

            {formError && (
              <p className="text-sm text-red-500">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-violet-500 hover:bg-violet-600 text-white"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingMapping ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Excluded Users Section ─── */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex items-center gap-2">
          <UserX className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Excluded Users
          </h2>
          <span className="text-sm text-brand-grey">
            ({exclusions.length})
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Excluded users are never affected by role mappings, regardless of their job title.
        </p>

        {/* Search to add */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name or email to exclude…"
            value={excludeSearch}
            onChange={(e) => setExcludeSearch(e.target.value)}
            className="pl-9"
          />
          {excludeSearch.trim().length >= 2 && (
            <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white dark:bg-gray-900 border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {excludeSearching ? (
                <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
                </div>
              ) : excludeResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400">No users found</div>
              ) : (
                excludeResults.map((u) => {
                  const alreadyExcluded = exclusions.some(
                    (e) => e.email.toLowerCase() === u.mail?.toLowerCase(),
                  );
                  return (
                    <button
                      key={u.mail}
                      disabled={alreadyExcluded || !u.mail}
                      onClick={() => handleAddExclusion(u)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.displayName}</div>
                        <div className="text-xs text-gray-400 truncate">
                          {u.mail} {u.jobTitle && `· ${u.jobTitle}`}
                        </div>
                      </div>
                      {alreadyExcluded ? (
                        <span className="text-xs text-orange-500 shrink-0">Excluded</span>
                      ) : (
                        <Plus className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Excluded users list */}
        {exclusions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {exclusions.map((ex) => (
                <motion.div
                  key={ex.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 px-3 py-1.5 text-sm"
                >
                  <span className="font-medium text-orange-700 dark:text-orange-300">
                    {ex.displayName}
                  </span>
                  <span className="text-orange-400 dark:text-orange-500 text-xs">
                    {ex.email}
                  </span>
                  <button
                    onClick={() => { playClick(); setRemoveExcludeTarget(ex); }}
                    className="ml-1 rounded-full p-0.5 hover:bg-orange-200 dark:hover:bg-orange-800 text-orange-400 hover:text-orange-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Delete Mapping Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Mapping</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Remove the mapping for <strong>&ldquo;{deleteTarget?.jobTitle}&rdquo;</strong>?
            Users with this job title will default to &ldquo;Employee&rdquo; on their next
            login.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Exclusion Confirmation Dialog */}
      <Dialog open={!!removeExcludeTarget} onOpenChange={() => setRemoveExcludeTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Exclusion</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Re-enable role mapping for <strong>{removeExcludeTarget?.displayName}</strong>?
            Their role will be updated on their next login if a mapping matches their title.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveExcludeTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveExclusion}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
