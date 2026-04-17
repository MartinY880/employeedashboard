// ProConnect — Admin Ideas Moderation Page
// Table view with status management, selection for implementation, and deletion

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  ArrowLeft,
  Trash2,
  Rocket,
  Archive,
  Loader2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Flame,
  Sparkles,
  Wrench,
  CheckCircle2,
  MessageCircle,
  ChevronRight,
  Reply,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { renderMentionContent } from "@/components/shared/CommentSection";

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
  status: "ACTIVE" | "SELECTED" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
}

interface IdeaComment {
  id: string;
  authorName: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  replies?: IdeaComment[];
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  SELECTED: "Selected for Development",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ARCHIVED: "Deleted by User",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-700",
  SELECTED: "bg-emerald-100 text-emerald-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-violet-100 text-violet-700",
  ARCHIVED: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  ACTIVE: <Sparkles className="w-3.5 h-3.5" />,
  SELECTED: <Rocket className="w-3.5 h-3.5" />,
  IN_PROGRESS: <Wrench className="w-3.5 h-3.5" />,
  COMPLETED: <CheckCircle2 className="w-3.5 h-3.5" />,
  ARCHIVED: <Archive className="w-3.5 h-3.5" />,
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

type SortField = "title" | "authorName" | "votes" | "commentCount" | "status" | "createdAt";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<string, number> = {
  ACTIVE: 0,
  SELECTED: 1,
  IN_PROGRESS: 2,
  COMPLETED: 3,
  ARCHIVED: 4,
};

export default function AdminIdeasPage() {
  const { playClick, playSuccess, playNotify } = useSounds();
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IdeaItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);
  const [commentCache, setCommentCache] = useState<Record<string, IdeaComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<string | null>(null);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "votes" || field === "commentCount" || field === "createdAt" ? "desc" : "asc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3" />
      : <ChevronDown className="w-3 h-3" />;
  }

  const sortedIdeas = useMemo(() => {
    const arr = [...ideas];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
          break;
        case "authorName":
          cmp = a.authorName.localeCompare(b.authorName, undefined, { sensitivity: "base" });
          break;
        case "votes":
          cmp = a.votes - b.votes;
          break;
        case "commentCount":
          cmp = (a.commentCount ?? 0) - (b.commentCount ?? 0);
          break;
        case "status":
          cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [ideas, sortField, sortDir]);

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
    newStatus: "ACTIVE" | "SELECTED" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED"
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
      await fetch(`/api/ideas?id=${deleteTarget.id}&hard=true`, { method: "DELETE" });
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
  const inProgressCount = ideas.filter((i) => i.status === "IN_PROGRESS").length;
  const completedCount = ideas.filter((i) => i.status === "COMPLETED").length;
  const deletedByUsersCount = ideas.filter((i) => i.status === "ARCHIVED").length;

  async function toggleComments(ideaId: string) {
    if (expandedIdea === ideaId) {
      setExpandedIdea(null);
      return;
    }
    setExpandedIdea(ideaId);
    if (commentCache[ideaId]) return;
    setLoadingComments(ideaId);
    try {
      const res = await fetch(`/api/ideas/comments?ideaId=${ideaId}`);
      const data = await res.json();
      setCommentCache((prev) => ({ ...prev, [ideaId]: data.comments || data || [] }));
    } catch {
      setCommentCache((prev) => ({ ...prev, [ideaId]: [] }));
    } finally {
      setLoadingComments(null);
    }
  }

  async function handleDeleteComment(ideaId: string, commentId: string) {
    try {
      await fetch(`/api/ideas/comments?commentId=${commentId}`, { method: "DELETE" });
      setCommentCache((prev) => {
        const comments = prev[ideaId] || [];
        const filtered = comments
          .filter((c) => c.id !== commentId)
          .map((c) => ({ ...c, replies: (c.replies || []).filter((r) => r.id !== commentId) }));
        return { ...prev, [ideaId]: filtered };
      });
      setIdeas((prev) =>
        prev.map((i) => i.id === ideaId ? { ...i, commentCount: Math.max(0, (i.commentCount ?? 1) - 1) } : i)
      );
      playNotify();
    } catch { /* silent */ }
  }

  const filters = [
    { label: "All", value: null, count: ideas.length },
    { label: "Active", value: "ACTIVE", count: activeCount },
    { label: "Selected", value: "SELECTED", count: selectedCount },
    { label: "In Progress", value: "IN_PROGRESS", count: inProgressCount },
    { label: "Completed", value: "COMPLETED", count: completedCount },
    { label: "Deleted by Users", value: "ARCHIVED", count: deletedByUsersCount },
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
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-brand-grey" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue text-white">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Ideas Moderation</h1>
            <p className="text-xs text-brand-grey">
              {ideas.length} total &middot; {activeCount} active &middot; {selectedCount} selected &middot; {inProgressCount} in progress &middot; {completedCount} completed &middot; {deletedByUsersCount} deleted by users
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
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-200"
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">({f.count})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden overflow-x-hidden">
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
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%] cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => toggleSort("title")}>
                  <span className="flex items-center gap-1">Idea <SortIcon field="title" /></span>
                </TableHead>
                <TableHead className="w-[10%] cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => toggleSort("authorName")}>
                  <span className="flex items-center gap-1">Author <SortIcon field="authorName" /></span>
                </TableHead>
                <TableHead className="w-[6%] cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => toggleSort("votes")}>
                  <span className="flex items-center gap-1">Votes <SortIcon field="votes" /></span>
                </TableHead>
                <TableHead className="w-[8%] cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => toggleSort("commentCount")}>
                  <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Comments <SortIcon field="commentCount" /></span>
                </TableHead>
                <TableHead className="w-[14%] cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => toggleSort("status")}>
                  <span className="flex items-center gap-1">Status <SortIcon field="status" /></span>
                </TableHead>
                <TableHead className="w-[9%] cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => toggleSort("createdAt")}>
                  <span className="flex items-center gap-1">Submitted <SortIcon field="createdAt" /></span>
                </TableHead>
                <TableHead className="w-[18%] text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {sortedIdeas.map((idea, i) => {
                  const isTrending = idea.votes >= 15 && idea.status === "ACTIVE";
                  return (
                    <React.Fragment key={idea.id}>
                    <motion.tr
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-800 dark:bg-gray-800/50 transition-colors ${
                        idea.status === "ARCHIVED" ? "opacity-50" : ""
                      }`}
                    >
                      <TableCell>
                        <div className="overflow-hidden">
                          <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-start gap-1.5 whitespace-normal break-words overflow-wrap-anywhere" style={{ overflowWrap: 'anywhere' }}>
                            <span className="min-w-0">{idea.title}</span>
                            {isTrending && (
                              <span className="text-xs shrink-0" title="Trending">🔥</span>
                            )}
                          </div>
                          <div className="text-xs text-brand-grey mt-0.5 whitespace-normal break-words" style={{ overflowWrap: 'anywhere' }}>
                            {idea.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{idea.authorName}</span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            isTrending
                              ? "text-orange-600"
                              : idea.votes > 0
                              ? "text-brand-blue"
                              : "text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {idea.votes}
                        </span>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => { playClick(); toggleComments(idea.id); }}
                          className={`text-sm tabular-nums flex items-center gap-1 transition-colors rounded px-1.5 py-0.5 -ml-1.5 ${
                            expandedIdea === idea.id
                              ? "text-brand-blue bg-brand-blue/10"
                              : "text-gray-500 dark:text-gray-400 hover:text-brand-blue hover:bg-gray-100 dark:hover:bg-gray-800"
                          }`}
                        >
                          {expandedIdea === idea.id
                            ? <ChevronDown className="w-3 h-3" />
                            : <ChevronRight className="w-3 h-3" />}
                          <MessageCircle className="w-3 h-3" />
                          {idea.commentCount ?? 0}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] gap-1 ${STATUS_STYLES[idea.status]}`}
                        >
                          {STATUS_ICON[idea.status]}
                          {STATUS_LABELS[idea.status] || idea.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-brand-grey">
                          {formatDate(idea.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end items-center gap-1.5 pr-3">
                          {updatingId === idea.id ? (
                            <div className="flex items-center gap-1.5 text-xs text-brand-grey">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Updating…
                            </div>
                          ) : (
                            <Select
                              value={idea.status}
                              onValueChange={(val) => {
                                playClick();
                                handleStatusChange(idea, val as "ACTIVE" | "SELECTED" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED");
                              }}
                            >
                              <SelectTrigger className="h-7 w-[180px] text-xs gap-1 border-gray-200 dark:border-gray-700">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ACTIVE">
                                  <span className="flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3 text-blue-600" />
                                    Active
                                  </span>
                                </SelectItem>
                                <SelectItem value="SELECTED">
                                  <span className="flex items-center gap-1.5">
                                    <Rocket className="w-3 h-3 text-emerald-600" />
                                    Selected for Dev
                                  </span>
                                </SelectItem>
                                <SelectItem value="IN_PROGRESS">
                                  <span className="flex items-center gap-1.5">
                                    <Wrench className="w-3 h-3 text-amber-600" />
                                    In Progress
                                  </span>
                                </SelectItem>
                                <SelectItem value="COMPLETED">
                                  <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3 h-3 text-violet-600" />
                                    Completed
                                  </span>
                                </SelectItem>
                                <SelectItem value="ARCHIVED">
                                  <span className="flex items-center gap-1.5">
                                    <Archive className="w-3 h-3 text-gray-500" />
                                    Archived
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
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
                    {/* Expanded comments row */}
                    {expandedIdea === idea.id && (
                      <motion.tr
                        key={`${idea.id}-comments`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="bg-gray-50/50 dark:bg-gray-800/30"
                      >
                        <TableCell colSpan={7} className="px-6 py-3">
                          {loadingComments === idea.id ? (
                            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading comments…
                            </div>
                          ) : (commentCache[idea.id] || []).length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1">No comments</p>
                          ) : (
                            <div className="space-y-2">
                              {(commentCache[idea.id] || []).map((c) => (
                                <div key={c.id}>
                                  <div className="flex items-start gap-2 group/admincomment">
                                    <div className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-brand-blue/70 to-brand-blue flex items-center justify-center text-white text-[9px] font-bold">
                                      {c.authorName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{c.authorName}</span>
                                        <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                      </div>
                                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 whitespace-pre-wrap break-words">{renderMentionContent(c.content)}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(idea.id, c.id)}
                                      className="opacity-0 group-hover/admincomment:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1"
                                      title="Delete comment"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                  {/* Replies */}
                                  {(c.replies || []).map((r) => (
                                    <div key={r.id} className="flex items-start gap-2 ml-8 mt-1.5 group/adminreply">
                                      <div className="shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-brand-blue/50 to-brand-blue/80 flex items-center justify-center text-white text-[8px] font-bold">
                                        {r.authorName.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2">
                                          <Reply className="w-2.5 h-2.5 text-gray-400" />
                                          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{r.authorName}</span>
                                          <span className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 whitespace-pre-wrap break-words">{renderMentionContent(r.content)}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(idea.id, r.id)}
                                        className="opacity-0 group-hover/adminreply:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1"
                                        title="Delete reply"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </motion.tr>
                    )}
                    </React.Fragment>
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
