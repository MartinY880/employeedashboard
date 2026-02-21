// ProConnect — Admin Ideas Moderation Page
// Table view with status management, selection for implementation, and deletion

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  ArrowLeft,
  Trash2,
  Rocket,
  RotateCcw,
  Archive,
  Loader2,
  ChevronUp,
  Flame,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface IdeaItem {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  votes: number;
  status: "ACTIVE" | "SELECTED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-700",
  SELECTED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  ACTIVE: <Sparkles className="w-3.5 h-3.5" />,
  SELECTED: <Rocket className="w-3.5 h-3.5" />,
  ARCHIVED: <Archive className="w-3.5 h-3.5" />,
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AdminIdeasPage() {
  const { playClick, playSuccess, playNotify } = useSounds();
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IdeaItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const fetchIdeas = useCallback(async () => {
    try {
      const url = filterStatus
        ? `/api/ideas?status=${filterStatus}`
        : "/api/ideas";
      const res = await fetch(url);
      const data = await res.json();
      setIdeas(data.ideas || []);
    } catch {
      setIdeas([]);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  async function handleStatusChange(
    idea: IdeaItem,
    newStatus: "ACTIVE" | "SELECTED" | "ARCHIVED"
  ) {
    setUpdatingId(idea.id);
    try {
      await fetch("/api/ideas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: idea.id, status: newStatus }),
      });
      playSuccess();
      fetchIdeas();
    } catch {
      playNotify();
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/ideas?id=${deleteTarget.id}`, { method: "DELETE" });
      playNotify();
      setDeleteTarget(null);
      fetchIdeas();
    } catch {
      // Error handled silently
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const activeCount = ideas.filter((i) => i.status === "ACTIVE").length;
  const selectedCount = ideas.filter((i) => i.status === "SELECTED").length;
  const archivedCount = ideas.filter((i) => i.status === "ARCHIVED").length;

  const filters = [
    { label: "All", value: null, count: ideas.length },
    { label: "Active", value: "ACTIVE", count: activeCount },
    { label: "Selected", value: "SELECTED", count: selectedCount },
    { label: "Archived", value: "ARCHIVED", count: archivedCount },
  ];

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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue text-white">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ideas Moderation</h1>
            <p className="text-xs text-brand-grey">
              {ideas.length} total &middot; {activeCount} active &middot; {selectedCount} selected
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.label}
            onClick={() => {
              playClick();
              setFilterStatus(f.value);
              setIsLoading(true);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterStatus === f.value
                ? "bg-brand-blue text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">({f.count})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : ideas.length === 0 ? (
          <div className="p-12 text-center text-brand-grey">
            <Lightbulb className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No ideas found</p>
            <p className="text-sm mt-1">Ideas submitted by employees will appear here.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Idea</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>
                  <span className="flex items-center gap-1">
                    <ChevronUp className="w-3 h-3" /> Votes
                  </span>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {ideas.map((idea, i) => {
                  const isTrending = idea.votes >= 15 && idea.status === "ACTIVE";
                  return (
                    <motion.tr
                      key={idea.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${
                        idea.status === "ARCHIVED" ? "opacity-50" : ""
                      }`}
                    >
                      <TableCell>
                        <div>
                          <div className="font-semibold text-sm text-gray-900 truncate max-w-[340px] flex items-center gap-1.5">
                            {idea.title}
                            {isTrending && (
                              <span className="text-xs" title="Trending">🔥</span>
                            )}
                          </div>
                          <div className="text-xs text-brand-grey truncate max-w-[340px] mt-0.5">
                            {idea.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-700">{idea.authorName}</span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            isTrending
                              ? "text-orange-600"
                              : idea.votes > 0
                              ? "text-brand-blue"
                              : "text-gray-400"
                          }`}
                        >
                          {idea.votes}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] gap-1 ${STATUS_STYLES[idea.status]}`}
                        >
                          {STATUS_ICON[idea.status]}
                          {idea.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-brand-grey">
                          {formatDate(idea.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {idea.status === "ACTIVE" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1"
                              disabled={updatingId === idea.id}
                              onClick={() => handleStatusChange(idea, "SELECTED")}
                              title="Select for implementation"
                            >
                              {updatingId === idea.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Rocket className="w-3 h-3" />
                              )}
                              Select
                            </Button>
                          )}
                          {idea.status === "SELECTED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1"
                              disabled={updatingId === idea.id}
                              onClick={() => handleStatusChange(idea, "ACTIVE")}
                              title="Move back to active"
                            >
                              {updatingId === idea.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                              Revert
                            </Button>
                          )}
                          {idea.status !== "ARCHIVED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 gap-1"
                              disabled={updatingId === idea.id}
                              onClick={() => handleStatusChange(idea, "ARCHIVED")}
                              title="Archive idea"
                            >
                              <Archive className="w-3 h-3" />
                            </Button>
                          )}
                          {idea.status === "ARCHIVED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1"
                              disabled={updatingId === idea.id}
                              onClick={() => handleStatusChange(idea, "ACTIVE")}
                              title="Restore to active"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Restore
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => {
                              playClick();
                              setDeleteTarget(idea);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Idea</DialogTitle>
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
