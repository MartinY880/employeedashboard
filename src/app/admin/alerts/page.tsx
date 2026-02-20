// ProConnect — Admin Alerts CRUD Page
// Full table with create, edit, toggle active, delete alerts

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  Info,
  PartyPopper,
  UserPlus,
  Megaphone,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSounds } from "@/components/shared/SoundProvider";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface AlertItem {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  active: boolean;
  createdBy: string;
  author?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}

const ALERT_TYPES = ["INFO", "WARNING", "BIRTHDAY", "NEW_HIRE", "ANNOUNCEMENT"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const TYPE_ICON: Record<string, React.ReactNode> = {
  WARNING: <AlertTriangle className="w-3.5 h-3.5" />,
  INFO: <Info className="w-3.5 h-3.5" />,
  BIRTHDAY: <PartyPopper className="w-3.5 h-3.5" />,
  NEW_HIRE: <UserPlus className="w-3.5 h-3.5" />,
  ANNOUNCEMENT: <Megaphone className="w-3.5 h-3.5" />,
};

const TYPE_COLOR: Record<string, string> = {
  WARNING: "bg-amber-100 text-amber-700",
  INFO: "bg-blue-100 text-blue-700",
  BIRTHDAY: "bg-pink-100 text-pink-700",
  NEW_HIRE: "bg-green-100 text-green-700",
  ANNOUNCEMENT: "bg-purple-100 text-purple-700",
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-100 text-blue-600",
  HIGH: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-red-100 text-red-700",
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AdminAlertsPage() {
  const { playClick, playSuccess, playNotify } = useSounds();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlertItem | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formType, setFormType] = useState<string>("INFO");
  const [formPriority, setFormPriority] = useState<string>("LOW");

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts?active=false");
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch {
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  function openCreateDialog() {
    playClick();
    setEditingAlert(null);
    setFormTitle("");
    setFormContent("");
    setFormType("INFO");
    setFormPriority("LOW");
    setDialogOpen(true);
  }

  function openEditDialog(alert: AlertItem) {
    playClick();
    setEditingAlert(alert);
    setFormTitle(alert.title);
    setFormContent(alert.content);
    setFormType(alert.type);
    setFormPriority(alert.priority);
    setDialogOpen(true);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      if (editingAlert) {
        await fetch("/api/alerts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingAlert.id,
            title: formTitle,
            content: formContent,
            type: formType,
            priority: formPriority,
          }),
        });
      } else {
        await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle,
            content: formContent,
            type: formType,
            priority: formPriority,
          }),
        });
      }
      playSuccess();
      setDialogOpen(false);
      fetchAlerts();
    } catch {
      // Error handled silently
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(alert: AlertItem) {
    playClick();
    try {
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alert.id, active: !alert.active }),
      });
      fetchAlerts();
    } catch {
      // Error handled silently
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/alerts?id=${deleteTarget.id}`, { method: "DELETE" });
      playNotify();
      setDeleteTarget(null);
      fetchAlerts();
    } catch {
      // Error handled silently
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const activeCount = alerts.filter((a) => a.active).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[1200px] mx-auto px-6 py-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-brand-grey" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-white">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Alerts Management</h1>
            <p className="text-xs text-brand-grey">
              {alerts.length} total &middot; {activeCount} active
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog} className="bg-brand-blue hover:bg-brand-blue/90">
          <Plus className="w-4 h-4 mr-1.5" /> New Alert
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center text-brand-grey">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No alerts yet</p>
            <p className="text-sm mt-1">Create your first alert to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Alert</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {alerts.map((alert, i) => (
                  <motion.tr
                    key={alert.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${
                      !alert.active ? "opacity-60" : ""
                    }`}
                  >
                    <TableCell>
                      <div>
                        <div className="font-semibold text-sm text-gray-900 truncate max-w-[340px]">
                          {alert.title}
                        </div>
                        <div className="text-xs text-brand-grey truncate max-w-[340px] mt-0.5">
                          {alert.content}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] gap-1 ${TYPE_COLOR[alert.type] || "bg-gray-100"}`}
                      >
                        {TYPE_ICON[alert.type]}
                        {alert.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${PRIORITY_COLOR[alert.priority] || "bg-gray-100"}`}
                      >
                        {alert.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleActive(alert)}
                        className="flex items-center gap-1.5 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        {alert.active ? (
                          <>
                            <ToggleRight className="w-5 h-5 text-green-500" />
                            <span className="text-green-600">Active</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                            <span className="text-gray-400">Inactive</span>
                          </>
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-brand-grey">
                        {formatDate(alert.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditDialog(alert)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            playClick();
                            setDeleteTarget(alert);
                          }}
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
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editingAlert ? "Edit Alert" : "Create New Alert"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Title</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Alert title..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Content</label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Alert message content..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALERT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        <span className="flex items-center gap-2">
                          {TYPE_ICON[t]} {t}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Priority</label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formTitle.trim() || !formContent.trim() || isSaving}
              className="bg-brand-blue hover:bg-brand-blue/90"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {editingAlert ? "Save Changes" : "Create Alert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Alert</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-brand-grey py-2">
            Are you sure you want to permanently delete{" "}
            <strong>&ldquo;{deleteTarget?.title}&rdquo;</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
