// ProConnect — Admin Comment Moderation
// View all comments across widgets, filter by widget/date/status, soft-delete and restore

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Trash2,
  RotateCcw,
  Loader2,
  MessageCircle,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const WIDGET_OPTIONS = [
  { value: "all", label: "All Widgets" },
  { value: "props", label: "Props" },
  { value: "ideas", label: "Ideas" },
  { value: "celebrations", label: "Celebrations" },
  { value: "video-spotlight", label: "Video Spotlight" },
  { value: "myshare", label: "MyShare Feed" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "All Comments" },
  { value: "active", label: "Active" },
  { value: "deleted", label: "Deleted by User" },
] as const;

const WIDGET_COLORS: Record<string, string> = {
  props: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ideas: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  celebrations: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  "video-spotlight": "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  myshare: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

interface Comment {
  id: string;
  widget: string;
  authorName: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [widget, setWidget] = useState("all");
  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "delete" | "restore";
    comment: Comment | null;
  }>({ open: false, action: "delete", comment: null });

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (widget !== "all") params.set("widget", widget);
      if (status !== "all") params.set("status", status);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/admin/comments?${params}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [widget, status, fromDate, toDate]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleDelete = async (comment: Comment) => {
    setActionLoading(comment.id);
    try {
      const params = new URLSearchParams({ id: comment.id, widget: comment.widget });
      await fetch(`/api/admin/comments?${params}`, { method: "DELETE" });
      await fetchComments();
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, action: "delete", comment: null });
    }
  };

  const handleRestore = async (comment: Comment) => {
    setActionLoading(comment.id);
    try {
      await fetch("/api/admin/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: comment.id, widget: comment.widget }),
      });
      await fetchComments();
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, action: "restore", comment: null });
    }
  };

  const filtered = comments.filter((c) =>
    c.authorName.toLowerCase().includes(search.toLowerCase()) ||
    c.content.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
          <MessageCircle className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Comment Moderation</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            View and manage all comments across every widget
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <Filter className="w-4 h-4 text-gray-400 mt-6" />

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Author or content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-56"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Widget</label>
          <Select value={widget} onValueChange={setWidget}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WIDGET_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">From</label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">To</label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40"
          />
        </div>

        {(widget !== "all" || status !== "all" || fromDate || toDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setWidget("all");
              setStatus("all");
              setFromDate("");
              setToDate("");
            }}
            className="text-xs"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span>
          {loading ? "Loading..." : `${filtered.length} comment${filtered.length !== 1 ? "s" : ""}`}
        </span>
        {status === "deleted" && !loading && (
          <Badge variant="outline" className="text-xs">Showing deleted only</Badge>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 dark:bg-gray-800/50">
              <TableHead className="w-28">Widget</TableHead>
              <TableHead className="w-36">Author</TableHead>
              <TableHead>Content</TableHead>
              <TableHead className="w-32">Type</TableHead>
              <TableHead className="w-40">Date</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                  No comments found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((comment) => (
                <TableRow
                  key={`${comment.widget}-${comment.id}`}
                  className={comment.deletedAt ? "opacity-60" : ""}
                >
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${WIDGET_COLORS[comment.widget] ?? "bg-gray-100 text-gray-700"}`}>
                      {WIDGET_OPTIONS.find((w) => w.value === comment.widget)?.label ?? comment.widget}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {comment.authorName}
                  </TableCell>
                  <TableCell className="text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
                    {comment.content}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {comment.parentId ? "Reply" : "Top-level"}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {formatDate(comment.createdAt)}
                  </TableCell>
                  <TableCell>
                    {comment.deletedAt ? (
                      <Badge variant="destructive" className="text-xs">Deleted</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {comment.deletedAt ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionLoading === comment.id}
                        onClick={() =>
                          setConfirmDialog({ open: true, action: "restore", comment })
                        }
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      >
                        {actionLoading === comment.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionLoading === comment.id}
                        onClick={() =>
                          setConfirmDialog({ open: true, action: "delete", comment })
                        }
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        {actionLoading === comment.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog({ open: false, action: "delete", comment: null });
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action === "delete" ? "Delete Comment" : "Restore Comment"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === "delete"
                ? "This will soft-delete the comment. It can be restored later."
                : "This will restore the comment and make it visible again."}
            </DialogDescription>
          </DialogHeader>

          {confirmDialog.comment && (
            <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-700 dark:text-gray-300 max-h-32 overflow-y-auto">
              <p className="font-medium text-xs text-gray-500 mb-1">
                {confirmDialog.comment.authorName} &middot;{" "}
                {WIDGET_OPTIONS.find((w) => w.value === confirmDialog.comment!.widget)?.label}
              </p>
              {confirmDialog.comment.content}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmDialog({ open: false, action: "delete", comment: null })}
            >
              Cancel
            </Button>
            <Button
              variant={confirmDialog.action === "delete" ? "destructive" : "default"}
              disabled={actionLoading === confirmDialog.comment?.id}
              onClick={() => {
                if (!confirmDialog.comment) return;
                if (confirmDialog.action === "delete") {
                  handleDelete(confirmDialog.comment);
                } else {
                  handleRestore(confirmDialog.comment);
                }
              }}
            >
              {actionLoading === confirmDialog.comment?.id && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {confirmDialog.action === "delete" ? "Delete" : "Restore"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
