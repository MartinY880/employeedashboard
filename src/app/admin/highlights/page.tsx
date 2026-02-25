// ProConnect — Admin Employee Highlights Management
// Full CRUD for employee spotlight / highlight entries
// Employee picker searches the company directory

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  Loader2,
  Search,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Highlight {
  id: string;
  employeeId: string | null;
  employeeName: string;
  jobTitle: string | null;
  department: string | null;
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  active: boolean;
  startDate: string;
  endDate: string | null;
  createdAt: string;
}

interface DirectoryUser {
  id: string;
  displayName: string;
  mail: string;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  photoUrl?: string;
}

/* ─── Employee Search Picker ───────────────────────────── */

function EmployeePicker({
  selectedName,
  onSelect,
}: {
  selectedName: string;
  onSelect: (user: DirectoryUser) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/directory?search=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data.users || []);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
          placeholder="Search employee directory…"
          className="pl-8 h-9 text-sm"
        />
        {searching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />
        )}
      </div>

      {/* Selected indicator */}
      {selectedName && (
        <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
          ✓ Selected: {selectedName}
        </p>
      )}

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 top-full mt-1 left-0 right-0 bg-white rounded-lg border border-gray-200 shadow-lg max-h-[240px] overflow-y-auto"
          >
            {results.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  onSelect(user);
                  setQuery("");
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.photoUrl || `/api/directory/photo?userId=${user.id}&name=${encodeURIComponent(user.displayName)}&size=48x48`}
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {user.jobTitle}{user.department ? ` · ${user.department}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminHighlightsPage() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Highlight | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [formEmployeeId, setFormEmployeeId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formJobTitle, setFormJobTitle] = useState("");
  const [formDepartment, setFormDepartment] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formSubtitle, setFormSubtitle] = useState("");

  const fetchHighlights = useCallback(async () => {
    try {
      const res = await fetch("/api/highlights?all=true");
      const data = await res.json();
      setHighlights(data);
    } catch {
      setHighlights([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  const openCreate = () => {
    setEditing(null);
    setFormEmployeeId(null);
    setFormName("");
    setFormJobTitle("");
    setFormDepartment("");
    setFormTitle("");
    setFormSubtitle("");
    setDialogOpen(true);
  };

  const openEdit = (h: Highlight) => {
    setEditing(h);
    setFormEmployeeId(h.employeeId);
    setFormName(h.employeeName);
    setFormJobTitle(h.jobTitle || "");
    setFormDepartment(h.department || "");
    setFormTitle(h.title);
    setFormSubtitle(h.subtitle);
    setDialogOpen(true);
  };

  const handleEmployeeSelect = (user: DirectoryUser) => {
    setFormEmployeeId(user.id);
    setFormName(user.displayName);
    setFormJobTitle(user.jobTitle || "");
    setFormDepartment(user.department || "");
  };

  const handleSave = async () => {
    if (!formName.trim() || !formTitle.trim() || !formSubtitle.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await fetch("/api/highlights", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editing.id,
            employeeId: formEmployeeId,
            employeeName: formName.trim(),
            jobTitle: formJobTitle.trim() || null,
            department: formDepartment.trim() || null,
            title: formTitle.trim(),
            subtitle: formSubtitle.trim(),
          }),
        });
      } else {
        await fetch("/api/highlights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: formEmployeeId,
            employeeName: formName.trim(),
            jobTitle: formJobTitle.trim() || null,
            department: formDepartment.trim() || null,
            title: formTitle.trim(),
            subtitle: formSubtitle.trim(),
          }),
        });
      }
      setDialogOpen(false);
      await fetchHighlights();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (h: Highlight) => {
    await fetch("/api/highlights", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: h.id, active: !h.active }),
    });
    await fetchHighlights();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/highlights?id=${id}`, { method: "DELETE" });
    setDeleteId(null);
    await fetchHighlights();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto px-6 py-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
            <Star className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Employee Highlights</h1>
            <p className="text-sm text-brand-grey">Manage employee spotlights on the dashboard</p>
          </div>
        </div>
        <div className="ml-auto">
          <Button
            onClick={openCreate}
            className="bg-brand-blue hover:bg-brand-blue/90 text-white gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Highlight
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Employee</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Title</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Subtitle</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-brand-grey">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading…
                  </td>
                </tr>
              ) : highlights.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-brand-grey">
                    No highlights yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {highlights.map((h) => (
                    <motion.tr
                      key={h.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-gray-50 hover:bg-gray-50/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={h.avatarUrl || `/api/directory/photo?userId=${h.employeeId || "none"}&name=${encodeURIComponent(h.employeeName)}&size=48x48`}
                            alt={h.employeeName}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
                          />
                          <div>
                            <p className="font-medium text-gray-900">{h.employeeName}</p>
                            {(h.jobTitle || h.department) && (
                              <p className="text-xs text-gray-400">{h.jobTitle}{h.department ? ` · ${h.department}` : ""}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{h.title}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{h.subtitle}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={h.active ? "default" : "secondary"}
                          className={h.active ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                        >
                          {h.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={h.active ? "Deactivate" : "Activate"}
                            onClick={() => handleToggle(h)}
                          >
                            {h.active ? (
                              <ToggleRight className="w-4 h-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-gray-400" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Edit"
                            onClick={() => openEdit(h)}
                          >
                            <Pencil className="w-4 h-4 text-brand-grey" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-600"
                            title="Delete"
                            onClick={() => setDeleteId(h.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Highlight" : "New Employee Highlight"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the employee highlight details."
                : "Create a new employee highlight to showcase on the dashboard."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Employee *
              </label>
              <EmployeePicker
                selectedName={formName}
                onSelect={handleEmployeeSelect}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Title *
              </label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Employee of the Month"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Subtitle / Description *
              </label>
              <textarea
                value={formSubtitle}
                onChange={(e) => setFormSubtitle(e.target.value)}
                placeholder="Why this employee is being highlighted…"
                rows={3}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formTitle.trim() || !formSubtitle.trim()}
                className="bg-brand-blue hover:bg-brand-blue/90 text-white gap-1.5"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? "Save Changes" : "Create Highlight"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Highlight</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this employee highlight? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
