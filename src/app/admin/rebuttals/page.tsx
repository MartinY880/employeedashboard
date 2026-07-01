// ProConnect — Admin Rebuttals Management
// CRUD for Rebuttal of the Day entries

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquareQuote,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  Loader2,
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface RebuttalItem {
  id: string;
  objection: string;
  rebuttal: string;
  isActive: boolean;
  lastShownAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminRebuttalsPage() {
  const [rebuttals, setRebuttals] = useState<RebuttalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RebuttalItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formObjection, setFormObjection] = useState("");
  const [formRebuttal, setFormRebuttal] = useState("");

  const fetchRebuttals = useCallback(async () => {
    try {
      const res = await fetch("/api/rebuttals?all=true");
      const data = await res.json();
      setRebuttals(Array.isArray(data) ? data : []);
    } catch {
      setRebuttals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRebuttals();
  }, [fetchRebuttals]);

  const openCreate = () => {
    setEditing(null);
    setFormObjection("");
    setFormRebuttal("");
    setDialogOpen(true);
  };

  const openEdit = (r: RebuttalItem) => {
    setEditing(r);
    setFormObjection(r.objection);
    setFormRebuttal(r.rebuttal);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formObjection.trim() || !formRebuttal.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await fetch("/api/rebuttals", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editing.id,
            objection: formObjection.trim(),
            rebuttal: formRebuttal.trim(),
          }),
        });
      } else {
        await fetch("/api/rebuttals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objection: formObjection.trim(),
            rebuttal: formRebuttal.trim(),
          }),
        });
      }
      setDialogOpen(false);
      await fetchRebuttals();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (r: RebuttalItem) => {
    await fetch("/api/rebuttals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, isActive: !r.isActive }),
    });
    await fetchRebuttals();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/rebuttals?id=${id}`, { method: "DELETE" });
    setDeleteId(null);
    await fetchRebuttals();
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
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <MessageSquareQuote className="w-5 h-5 text-brand-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Rebuttal of the Day</h1>
            <p className="text-sm text-brand-grey">Manage daily objection/rebuttal pairs shown on the dashboard</p>
          </div>
        </div>
        <div className="ml-auto">
          <Button
            onClick={openCreate}
            className="bg-brand-blue hover:bg-brand-blue/90 text-white gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Rebuttal
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Objection</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Rebuttal</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-brand-grey">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading…
                  </td>
                </tr>
              ) : rebuttals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-brand-grey">
                    No rebuttals yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {rebuttals.map((r) => (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{r.objection}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <p className="text-gray-600 dark:text-gray-400 line-clamp-2">{r.rebuttal}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={r.isActive ? "default" : "secondary"}
                          className={r.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                        >
                          {r.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={r.isActive ? "Deactivate" : "Activate"}
                            onClick={() => handleToggle(r)}
                          >
                            {r.isActive ? (
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
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="w-4 h-4 text-brand-grey" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-600"
                            title="Delete"
                            onClick={() => setDeleteId(r.id)}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Rebuttal" : "New Rebuttal"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the objection and rebuttal text."
                : "Add a new objection/rebuttal pair to the rotation."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Objection *
              </label>
              <Input
                value={formObjection}
                onChange={(e) => setFormObjection(e.target.value)}
                placeholder="e.g. The rate is too high right now"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Rebuttal *
              </label>
              <textarea
                value={formRebuttal}
                onChange={(e) => setFormRebuttal(e.target.value)}
                placeholder="How to respond to this objection…"
                rows={4}
                className="w-full rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue resize-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formObjection.trim() || !formRebuttal.trim()}
              className="bg-brand-blue hover:bg-brand-blue/90 text-white gap-1.5"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Save Changes" : "Create Rebuttal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Rebuttal</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this rebuttal? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
