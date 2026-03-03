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
  Loader2,
  RefreshCw,
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
  const [formDate, setFormDate] = useState("");
  const [formRecurType, setFormRecurType] = useState("none");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    setFormDate("");
    setFormRecurType("none");
    setDialogOpen(true);
  };

  const openEditDialog = (item: ImportantDateItem) => {
    playClick();
    setEditingDate(item);
    setFormLabel(item.label);
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
        <Button onClick={openCreateDialog} className="bg-brand-blue hover:bg-brand-blue/90 text-white gap-1.5">
          <Plus className="w-4 h-4" />
          Add Date
        </Button>
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
                <TableHead>Date</TableHead>
                <TableHead className="text-center">Recurring</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {dates.map((item, idx) => (
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
                          onClick={() => handleReorder(idx, "up")}
                          disabled={idx === 0}
                          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-20 transition-colors"
                        >
                          <ArrowUp className="w-3.5 h-3.5 text-brand-grey" />
                        </button>
                        <button
                          onClick={() => handleReorder(idx, "down")}
                          disabled={idx === dates.length - 1}
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
