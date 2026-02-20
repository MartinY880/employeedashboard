// ProConnect — Admin Pillars Management
// Full CRUD for company pillar cards displayed on the dashboard

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Shield,
  Save,
  Plus,
  Trash2,
  GripVertical,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ICON_MAP, ICON_NAMES, type PillarData, type PillarIconName } from "@/lib/pillar-icons";

export default function AdminPillarsPage() {
  const [pillars, setPillars] = useState<PillarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchPillars = useCallback(async () => {
    try {
      const res = await fetch("/api/pillars");
      const data = await res.json();
      if (Array.isArray(data)) setPillars(data);
    } catch {
      // Keep current state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPillars();
  }, [fetchPillars]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/pillars", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pillars),
      });
      if (res.ok) {
        setSaved(true);
        setHasChanges(false);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // Handle error silently
    } finally {
      setSaving(false);
    }
  };

  const addPillar = () => {
    const newPillar: PillarData = {
      id: `p${Date.now()}`,
      icon: "Star",
      title: "New Pillar",
      message: "Enter the pillar description here.",
    };
    setPillars((prev) => [...prev, newPillar]);
    setHasChanges(true);
  };

  const updatePillar = (id: string, field: keyof PillarData, value: string) => {
    setPillars((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
    setHasChanges(true);
  };

  const deletePillar = (id: string) => {
    setPillars((prev) => prev.filter((p) => p.id !== id));
    setDeleteId(null);
    setHasChanges(true);
  };

  const handleReorder = (newOrder: PillarData[]) => {
    setPillars(newOrder);
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="max-w-[900px] mx-auto px-6 py-6">
        <div className="flex items-center gap-2 text-brand-grey">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading pillars…</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[900px] mx-auto px-6 py-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-brand-blue hover:border-brand-blue/30 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue text-white">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Company Pillars</h1>
            <p className="text-sm text-brand-grey">
              Edit the pillar cards displayed on the dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addPillar}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Pillar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="bg-brand-blue hover:bg-brand-blue/90 text-white min-w-[100px]"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1.5" />
                Save All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Info banner */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          You have unsaved changes. Click &quot;Save All&quot; to apply.
        </motion.div>
      )}

      {/* Pillar list */}
      <Reorder.Group
        axis="y"
        values={pillars}
        onReorder={handleReorder}
        className="space-y-3"
      >
        <AnimatePresence mode="popLayout">
          {pillars.map((pillar, index) => {
            const IconPreview = ICON_MAP[pillar.icon] ?? ICON_MAP.Shield;

            return (
              <Reorder.Item
                key={pillar.id}
                value={pillar}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md hover:border-brand-blue/15 transition-all"
              >
                <div className="flex items-start gap-3">
                  {/* Drag handle */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing shrink-0 mt-1">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Icon preview */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-[#084f96] text-white shrink-0 mt-1">
                    <IconPreview className="w-6 h-6" />
                  </div>

                  {/* Fields */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Icon selector */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                          Icon
                        </label>
                        <Select
                          value={pillar.icon}
                          onValueChange={(v) =>
                            updatePillar(pillar.id, "icon", v)
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ICON_NAMES.map((name) => {
                              const Ic = ICON_MAP[name];
                              return (
                                <SelectItem key={name} value={name}>
                                  <span className="flex items-center gap-2">
                                    <Ic className="w-4 h-4" />
                                    {name}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Title */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                          Title
                        </label>
                        <Input
                          value={pillar.title}
                          onChange={(e) =>
                            updatePillar(pillar.id, "title", e.target.value)
                          }
                          placeholder="Pillar title"
                          className="h-9"
                        />
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                        Message
                      </label>
                      <Textarea
                        value={pillar.message}
                        onChange={(e) =>
                          updatePillar(pillar.id, "message", e.target.value)
                        }
                        placeholder="Pillar description…"
                        rows={2}
                        className="resize-none text-sm"
                      />
                    </div>
                  </div>

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(pillar.id)}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0 mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Reorder.Item>
            );
          })}
        </AnimatePresence>
      </Reorder.Group>

      {/* Empty state */}
      {pillars.length === 0 && (
        <div className="text-center py-12 text-brand-grey">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No pillars yet</p>
          <p className="text-sm mt-1">Click &quot;Add Pillar&quot; to create your first company pillar.</p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Pillar</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this pillar? This action cannot be undone after saving.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deletePillar(deleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
