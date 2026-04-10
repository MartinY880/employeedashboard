// ProConnect — Be Brilliant Widget
// Compact idea board for the dashboard center column: Trending, Fresh Ideas, Selected

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Sparkles,
  Rocket,
  ChevronUp,
  ChevronDown,
  Plus,
  Send,
  Loader2,
  Lightbulb,
  X,
  Wrench,
  CheckCircle2,
  Trash2,
  ArrowDownWideNarrow,
  Clock,
} from "lucide-react";
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
import { useIdeas } from "@/hooks/useIdeas";
import { useSounds } from "@/components/shared/SoundProvider";
import { MentionInput } from "@/components/shared/MentionInput";
import { CommentSection, renderMentionContent } from "@/components/shared/CommentSection";
import { mentionDisplayLength } from "@/lib/mentions";
import type { Idea, UnifiedComment } from "@/types";

const TRENDING_THRESHOLD = 15;

/* ─── Comment Thread (shared by IdeaCard + SelectedIdeaRow) ── */

function CommentThread({ ideaId, commentCount }: { ideaId: string; commentCount: number }) {
  const fetchComments = useCallback(async (entityId: string): Promise<UnifiedComment[]> => {
    const res = await fetch(`/api/ideas/comments?ideaId=${entityId}`);
    const data = await res.json();
    return data.comments || [];
  }, []);

  const submitComment = useCallback(async (entityId: string, content: string, parentId?: string): Promise<UnifiedComment> => {
    const res = await fetch("/api/ideas/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideaId: entityId, content, parentId: parentId || null }),
    });
    const data = await res.json();
    return data.comment;
  }, []);

  const likeComment = useCallback(async (_entityId: string, commentId: string): Promise<void> => {
    await fetch("/api/ideas/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });
  }, []);

  const deleteComment = useCallback(async (_entityId: string, commentId: string): Promise<void> => {
    await fetch(`/api/ideas/comments?id=${commentId}`, { method: "DELETE" });
  }, []);

  return (
    <CommentSection
      entityId={ideaId}
      commentCount={commentCount}
      onFetchComments={fetchComments}
      onSubmit={submitComment}
      onLike={likeComment}
      onDelete={deleteComment}
    />
  );
}

/* ─── Compact Idea Card ────────────────────────────────── */

function IdeaCard({
  idea,
  onVote,
  onDeleteIdea,
  canDeleteIdea = false,
  isDeleting = false,
  userVote,
  isTrending,
}: {
  idea: Idea;
  onVote: (id: string, dir: "up" | "down") => void;
  onDeleteIdea?: (id: string) => void;
  canDeleteIdea?: boolean;
  isDeleting?: boolean;
  userVote?: "up" | "down" | null;
  isTrending?: boolean;
}) {
  const { playClick } = useSounds();
  const upTitle =
    userVote === "up"
      ? "Remove upvote"
      : userVote === "down"
        ? "Switch to upvote"
        : "Upvote";
  const downTitle =
    userVote === "down"
      ? "Remove downvote"
      : userVote === "up"
        ? "Switch to downvote"
        : "Downvote";

  const timeAgo = getTimeAgo(idea.createdAt);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ layout: { type: "spring", stiffness: 400, damping: 30 } }}
      className={`group relative flex items-start gap-3 p-3 rounded-lg border transition-all hover:shadow-sm ${
        isTrending
          ? "border-orange-200 dark:border-orange-800/50 bg-gradient-to-r from-orange-50/60 to-amber-50/40 dark:from-orange-950/40 dark:to-amber-950/30 hover:border-orange-300 dark:hover:border-orange-700"
          : "border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-600"
      }`}
    >
      {/* Vote Buttons */}
      <div className="flex flex-col items-center gap-0 shrink-0 pt-0.5">
        <button
          type="button"
          onClick={() => {
            playClick();
            onVote(idea.id, "up");
          }}
          className={`w-6 h-6 flex items-center justify-center rounded transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue/40 ${
            userVote === "up"
              ? "text-brand-blue bg-brand-blue/10"
              : "text-gray-400 dark:text-gray-500 hover:text-brand-blue hover:bg-brand-blue/10"
          }`}
          title={upTitle}
          aria-pressed={userVote === "up"}
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <span
          className={`text-xs font-bold tabular-nums leading-none ${
            isTrending ? "text-orange-600" : "text-gray-700 dark:text-gray-300"
          }`}
        >
          {idea.votes}
        </span>
        <button
          type="button"
          onClick={() => {
            playClick();
            onVote(idea.id, "down");
          }}
          className={`w-6 h-6 flex items-center justify-center rounded transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400/50 ${
            userVote === "down"
              ? "text-red-500 bg-red-50"
              : "text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
          }`}
          title={downTitle}
          aria-pressed={userVote === "down"}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5 mb-0.5">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight break-words">
            {idea.title}
          </span>
          {isTrending && (
            <span className="shrink-0 text-xs" title="Trending!">
              🔥
            </span>
          )}
          {canDeleteIdea && onDeleteIdea && (
            <button
              type="button"
              onClick={() => onDeleteIdea(idea.id)}
              disabled={isDeleting}
              className="ml-auto shrink-0 text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
              title="Delete idea"
              aria-label="Delete idea"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        <p className="text-xs text-brand-grey leading-relaxed mb-1.5 whitespace-pre-wrap break-words">
          {renderMentionContent(idea.description)}
        </p>
        <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
          <span className="font-medium text-gray-500 dark:text-gray-400">{idea.authorName}</span>
          <span>·</span>
          <span>{timeAgo}</span>
        </div>
        <CommentThread ideaId={idea.id} commentCount={idea.commentCount ?? 0} />
      </div>


    </motion.div>
  );
}

/* ─── Selected / In Progress / Completed Idea Row ──────── */

const STAGE_CONFIG: Record<string, { label: string; icon: React.ReactNode; bgClass: string; borderClass: string; iconBgClass: string; badgeBgClass: string; badgeTextClass: string }> = {
  SELECTED: {
    label: "Selected",
    icon: <Rocket className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />,
    bgClass: "bg-emerald-50/60 dark:bg-emerald-950/40",
    borderClass: "border-emerald-100 dark:border-emerald-800/50",
    iconBgClass: "bg-emerald-100 dark:bg-emerald-900/60",
    badgeBgClass: "bg-emerald-100 dark:bg-emerald-900/60",
    badgeTextClass: "text-emerald-700 dark:text-emerald-300",
  },
  IN_PROGRESS: {
    label: "In Progress",
    icon: <Wrench className="w-3 h-3 text-amber-600 dark:text-amber-400" />,
    bgClass: "bg-amber-50/60 dark:bg-amber-950/40",
    borderClass: "border-amber-100 dark:border-amber-800/50",
    iconBgClass: "bg-amber-100 dark:bg-amber-900/60",
    badgeBgClass: "bg-amber-100 dark:bg-amber-900/60",
    badgeTextClass: "text-amber-700 dark:text-amber-300",
  },
  COMPLETED: {
    label: "Completed",
    icon: <CheckCircle2 className="w-3 h-3 text-violet-600 dark:text-violet-400" />,
    bgClass: "bg-violet-50/60 dark:bg-violet-950/40",
    borderClass: "border-violet-100 dark:border-violet-800/50",
    iconBgClass: "bg-violet-100 dark:bg-violet-900/60",
    badgeBgClass: "bg-violet-100 dark:bg-violet-900/60",
    badgeTextClass: "text-violet-700 dark:text-violet-300",
  },
};

function SelectedIdeaRow({ idea }: { idea: Idea }) {
  const timeAgo = getTimeAgo(idea.createdAt);
  const config = STAGE_CONFIG[idea.status] || STAGE_CONFIG.SELECTED;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-start gap-2.5 p-3 rounded-lg ${config.bgClass} border ${config.borderClass}`}
    >
      <div className={`flex items-center justify-center w-5 h-5 rounded-full ${config.iconBgClass} shrink-0 mt-0.5`}>
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5 mb-0.5">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight break-words">
            {idea.title}
          </span>
          <Badge
            variant="secondary"
            className={`text-[9px] px-1.5 py-0 ${config.badgeBgClass} ${config.badgeTextClass} font-semibold shrink-0`}
          >
            {config.label}
          </Badge>
        </div>
        <p className="text-xs text-brand-grey leading-relaxed mb-1.5 whitespace-pre-wrap break-words">
          {renderMentionContent(idea.description)}
        </p>
        <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
          <span className="font-medium text-gray-500 dark:text-gray-400">{idea.authorName}</span>
          <span>·</span>
          <span>{timeAgo}</span>
          <span>·</span>
          <span>{idea.votes} votes</span>
        </div>
        <CommentThread ideaId={idea.id} commentCount={idea.commentCount ?? 0} />
      </div>
    </motion.div>
  );
}

/* ─── Submit Idea Form (Inline) ────────────────────────── */

function SubmitIdeaForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (title: string, description: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSending, setIsSending] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionLength = mentionDisplayLength(description);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setIsSending(true);
    setError("");
    try {
      await onSubmit(title.trim(), description.trim());
    } catch {
      setError("Failed to submit — please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={handleSubmit}
      className="space-y-2 p-3 rounded-lg border border-brand-blue/20 bg-brand-blue/5 overflow-hidden"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-brand-blue flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5" />
          Share your idea
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <Input
        ref={titleRef}
        placeholder="Idea title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-8 text-sm bg-white dark:bg-gray-900 dark:border-gray-700"
        maxLength={120}
      />
      <div className="relative">
        <MentionInput
          placeholder="Brief description..."
          value={description}
          onChange={setDescription}
          multiline
          className="text-sm bg-white dark:bg-gray-900 dark:border-gray-700 min-h-[60px] resize-none pb-5"
          maxLength={500}
          rows={3}
        />
        <span className={`absolute bottom-1.5 right-2 text-[10px] tabular-nums ${
          descriptionLength >= 480 ? "text-red-400" : descriptionLength >= 400 ? "text-amber-400" : "text-gray-300 dark:text-gray-600"
        }`}>
          {descriptionLength}/500
        </span>
      </div>
      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 text-xs"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!title.trim() || !description.trim() || isSending}
          className="h-7 text-xs bg-brand-blue hover:bg-brand-blue/90 text-white gap-1"
        >
          {isSending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Send className="w-3 h-3" />
          )}
          Submit
        </Button>
      </div>
    </motion.form>
  );
}

/* ─── Main Be Brilliant Widget ─────────────────────────── */

export function BeBrilliantWidget() {
  const { ideas, isLoading, submitIdea, voteIdea, userVotesByIdea, deleteIdea } = useIdeas();
  const { playSuccess, playClick } = useSounds();
  const [showForm, setShowForm] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "SELECTED" | "IN_PROGRESS" | "COMPLETED">("ACTIVE");
  const [wallSort, setWallSort] = useState<"votes" | "recent">("votes");
  const [currentUserDbId, setCurrentUserDbId] = useState<string | null>(null);
  const [deletingIdeaId, setDeletingIdeaId] = useState<string | null>(null);
  const [deleteTargetIdea, setDeleteTargetIdea] = useState<Idea | null>(null);

  // Active tab cards (IdeaCard) are taller; status tabs (SelectedIdeaRow) are compact
  const batchSize = 5;
  const [visibleCount, setVisibleCount] = useState(8);

  // Reset visible count to the appropriate batch when tab or sort changes
  useEffect(() => {
    setVisibleCount(8);
  }, [statusFilter, wallSort]);

  // Debounced re-sort: keep a "frozen" sort order while voting,
  // then re-sort 1.5s after the last vote click
  const [sortKey, setSortKey] = useState(0);
  const sortTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerDebouncedSort = useCallback(() => {
    if (sortTimerRef.current) clearTimeout(sortTimerRef.current);
    sortTimerRef.current = setTimeout(() => {
      setSortKey((k) => k + 1);
    }, 1500);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (sortTimerRef.current) clearTimeout(sortTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadCurrentUser = async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) {
          setCurrentUserDbId(typeof data?.dbUserId === "string" ? data.dbUserId : null);
        }
      } catch {
        // silent
      }
    };
    void loadCurrentUser();
    return () => {
      mounted = false;
    };
  }, []);

  const handleVote = useCallback(
    async (id: string, dir: "up" | "down") => {
      const didVote = await voteIdea(id, dir);
      if (didVote) {
        triggerDebouncedSort();
      }
    },
    [voteIdea, triggerDebouncedSort]
  );

  const visibleIdeas = ideas.filter((i) => i.status !== "ARCHIVED");
  const activeIdeas = visibleIdeas.filter((i) => i.status === "ACTIVE");

  // If the current filter tab has no ideas (e.g. all were archived), fall back to Active
  useEffect(() => {
    if (statusFilter !== "ACTIVE" && visibleIdeas.filter((i) => i.status === statusFilter).length === 0) {
      setStatusFilter("ACTIVE");
    }
  }, [visibleIdeas, statusFilter]);

  // Memoized sort order — only re-sorts when sortKey bumps (1.5s after last vote)
  const sortedOrderRef = useRef<string[]>([]);
  const ideasFingerprint = activeIdeas.map((i) => i.id).join(",");
  const prevSortKeyRef = useRef(sortKey);
  const prevFingerprintRef = useRef(ideasFingerprint);

  if (
    prevSortKeyRef.current !== sortKey ||
    prevFingerprintRef.current !== ideasFingerprint ||
    sortedOrderRef.current.length === 0
  ) {
    prevSortKeyRef.current = sortKey;
    prevFingerprintRef.current = ideasFingerprint;
    sortedOrderRef.current = [...activeIdeas]
      .sort((a, b) => b.votes - a.votes)
      .map((i) => i.id);
  }

  // Use the frozen sort order but with live vote counts
  const orderedActive = sortedOrderRef.current
    .map((id) => activeIdeas.find((i) => i.id === id))
    .filter((i): i is Idea => !!i);

  // "Most Recent" sort — by createdAt descending
  const recentSorted = [...activeIdeas].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const trendingIdeas = orderedActive
    .filter((i) => i.votes >= TRENDING_THRESHOLD);
  const freshIdeas = orderedActive
    .filter((i) => i.votes < TRENDING_THRESHOLD);

  // Build the sorted list for the current tab
  const getSortedForTab = useCallback((): Idea[] => {
    const pool = visibleIdeas.filter((i) => i.status === statusFilter);
    if (statusFilter === "ACTIVE") {
      return wallSort === "votes" ? orderedActive : recentSorted;
    }
    // For non-active tabs: apply sort
    return [...pool].sort((a, b) =>
      wallSort === "votes"
        ? b.votes - a.votes
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [visibleIdeas, statusFilter, wallSort, orderedActive, recentSorted]);

  const handleSubmit = async (title: string, description: string) => {
    await submitIdea(title, description);
    playSuccess();
    setShowForm(false);
    setJustSubmitted(true);
    setTimeout(() => setJustSubmitted(false), 3000);
  };

  const handleDeleteIdea = useCallback(
    async (idea: Idea) => {
      if (deletingIdeaId) return;
      if (idea.status === "IN_PROGRESS" || idea.status === "COMPLETED") return;
      setDeleteTargetIdea(idea);
    },
    [deletingIdeaId]
  );

  const confirmDeleteIdea = useCallback(async () => {
    if (!deleteTargetIdea || deletingIdeaId) return;
      try {
      setDeletingIdeaId(deleteTargetIdea.id);
      await deleteIdea(deleteTargetIdea.id);
      setDeleteTargetIdea(null);
      playSuccess();
      } catch {
        // silent
      } finally {
        setDeletingIdeaId(null);
      }
  }, [deleteIdea, deleteTargetIdea, deletingIdeaId, playSuccess]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="w-6 h-16 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <Dialog open={!!deleteTargetIdea} onOpenChange={(open) => !open && setDeleteTargetIdea(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Idea</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-brand-grey py-2">
            Are you sure you want to delete this idea?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTargetIdea(null)} disabled={!!deletingIdeaId}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDeleteIdea()} disabled={!!deletingIdeaId}>
              {deletingIdeaId ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
      {/* Tab Content */}
      <div className="p-4 space-y-4">
        {/* Success Banner */}
        <AnimatePresence>
          {justSubmitted && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Your idea has been submitted!
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          {/* Submit Row */}
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {!showForm ? (
                <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      playClick();
                      setShowForm(true);
                    }}
                    className="w-full h-8 text-xs border-dashed border-brand-blue/30 text-brand-blue hover:bg-brand-blue/5 hover:border-brand-blue/50 gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Submit an Idea
                  </Button>
                </motion.div>
              ) : (
                <div className="flex-1">
                  <SubmitIdeaForm
                    key="form"
                    onSubmit={handleSubmit}
                    onCancel={() => setShowForm(false)}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Status Filter Chips */}
          {visibleIdeas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(["ACTIVE", "SELECTED", "IN_PROGRESS", "COMPLETED"] as const).map((f) => {
                const count = visibleIdeas.filter((i) => i.status === f).length;
                if (count === 0 && f !== "ACTIVE") return null;
                const labels: Record<string, string> = { ACTIVE: "Active", SELECTED: "Selected", IN_PROGRESS: "In Progress", COMPLETED: "Completed" };
                const icons: Record<string, React.ReactNode> = {
                  ACTIVE: <Lightbulb className="w-3 h-3" />,
                  SELECTED: <Rocket className="w-3 h-3" />,
                  IN_PROGRESS: <Wrench className="w-3 h-3" />,
                  COMPLETED: <CheckCircle2 className="w-3 h-3" />,
                };
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { playClick(); setStatusFilter(f); }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                      statusFilter === f
                        ? "bg-brand-blue text-white border-brand-blue shadow-sm"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-brand-blue/40 hover:text-brand-blue"
                    }`}
                  >
                    {icons[f]}
                    {labels[f]}
                    <span className={`text-[9px] px-1 py-0 rounded-full font-bold ${
                      statusFilter === f ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sort Toggle — shown on all tabs */}
          {visibleIdeas.filter((i) => i.status === statusFilter).length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Sort:</span>
              <button
                type="button"
                onClick={() => { playClick(); setWallSort("votes"); }}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                  wallSort === "votes"
                    ? "bg-brand-blue text-white border-brand-blue shadow-sm"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-brand-blue/40 hover:text-brand-blue"
                }`}
              >
                <ArrowDownWideNarrow className="w-3 h-3" />
                Highest Votes
              </button>
              <button
                type="button"
                onClick={() => { playClick(); setWallSort("recent"); }}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                  wallSort === "recent"
                    ? "bg-brand-blue text-white border-brand-blue shadow-sm"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-brand-blue/40 hover:text-brand-blue"
                }`}
              >
                <Clock className="w-3 h-3" />
                Most Recent
              </button>
            </div>
          )}

          {/* ── Filtered Content ── */}
          {(() => {
            const allForTab = getSortedForTab();
            const paged = allForTab.slice(0, visibleCount);
            const hasMore = allForTab.length > visibleCount;

            if (allForTab.length === 0) {
              return (
                <div className="text-center py-6">
                  <Lightbulb className="w-8 h-8 text-brand-grey/30 mx-auto mb-2" />
                  <p className="text-sm text-brand-grey">No ideas match this filter.</p>
                </div>
              );
            }

            if (statusFilter === "ACTIVE") {
              return (
                <>
                  {wallSort === "votes" ? (
                    <>
                      {(() => {
                        const pagedTrending = paged.filter((i) => i.votes >= TRENDING_THRESHOLD);
                        const pagedFresh = paged.filter((i) => i.votes < TRENDING_THRESHOLD);
                        return (
                          <>
                            {pagedTrending.length > 0 && (
                              <section>
                                <h4 className="text-[11px] font-bold text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <Flame className="w-3.5 h-3.5" />
                                  Trending Now
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] px-1.5 py-0 bg-orange-100 text-orange-600 font-semibold ml-auto"
                                  >
                                    {TRENDING_THRESHOLD}+ votes
                                  </Badge>
                                </h4>
                                <div className="space-y-2">
                                  <AnimatePresence mode="popLayout">
                                    {pagedTrending.map((idea) => (
                                      <IdeaCard
                                        key={idea.id}
                                        idea={idea}
                                        onVote={handleVote}
                                        onDeleteIdea={() => void handleDeleteIdea(idea)}
                                        canDeleteIdea={currentUserDbId === idea.authorId && idea.status !== "IN_PROGRESS" && idea.status !== "COMPLETED"}
                                        isDeleting={deletingIdeaId === idea.id}
                                        userVote={userVotesByIdea[idea.id]}
                                        isTrending
                                      />
                                    ))}
                                  </AnimatePresence>
                                </div>
                              </section>
                            )}
                            {pagedFresh.length > 0 && (
                              <section>
                                <h4 className="text-[11px] font-bold text-brand-blue uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  Fresh Ideas
                                </h4>
                                <div className="space-y-2">
                                  <AnimatePresence mode="popLayout">
                                    {pagedFresh.map((idea) => (
                                      <IdeaCard
                                        key={idea.id}
                                        idea={idea}
                                        onVote={handleVote}
                                        onDeleteIdea={() => void handleDeleteIdea(idea)}
                                        canDeleteIdea={currentUserDbId === idea.authorId && idea.status !== "IN_PROGRESS" && idea.status !== "COMPLETED"}
                                        isDeleting={deletingIdeaId === idea.id}
                                        userVote={userVotesByIdea[idea.id]}
                                      />
                                    ))}
                                  </AnimatePresence>
                                </div>
                              </section>
                            )}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <section>
                      <h4 className="text-[11px] font-bold text-brand-blue uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Fresh Ideas
                      </h4>
                      <div className="space-y-2">
                        <AnimatePresence mode="popLayout">
                          {paged.map((idea) => (
                            <IdeaCard
                              key={idea.id}
                              idea={idea}
                              onVote={handleVote}
                              onDeleteIdea={() => void handleDeleteIdea(idea)}
                              canDeleteIdea={currentUserDbId === idea.authorId && idea.status !== "IN_PROGRESS" && idea.status !== "COMPLETED"}
                              isDeleting={deletingIdeaId === idea.id}
                              userVote={userVotesByIdea[idea.id]}
                              isTrending={idea.votes >= TRENDING_THRESHOLD}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </section>
                  )}
                  {hasMore && (
                    <div className="flex justify-center pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { playClick(); setVisibleCount((c) => c + batchSize); }}
                        className="h-8 text-xs border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-brand-blue hover:border-brand-blue/40 gap-1.5"
                      >
                        View More
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">({allForTab.length - visibleCount} remaining)</span>
                      </Button>
                    </div>
                  )}
                </>
              );
            }

            // Non-active tabs: Selected / In Progress / Completed
            const tabHeadings: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
              SELECTED: { label: "Selected Ideas", icon: <Rocket className="w-3.5 h-3.5" />, color: "text-emerald-600" },
              IN_PROGRESS: { label: "Ideas in Motion", icon: <Wrench className="w-3.5 h-3.5" />, color: "text-amber-600" },
              COMPLETED: { label: "Completed Ideas", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-violet-600" },
            };
            const heading = tabHeadings[statusFilter];

            return (
              <>
                <section>
                  {heading && (
                    <h4 className={`text-[11px] font-bold ${heading.color} uppercase tracking-wider mb-2 flex items-center gap-1.5`}>
                      {heading.icon}
                      {heading.label}
                    </h4>
                  )}
                  <div className="space-y-1.5">
                    {paged.map((idea) => (
                      <SelectedIdeaRow key={idea.id} idea={idea} />
                    ))}
                  </div>
                </section>
                {hasMore && (
                  <div className="flex justify-center pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { playClick(); setVisibleCount((c) => c + batchSize); }}
                      className="h-8 text-xs border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-brand-blue hover:border-brand-blue/40 gap-1.5"
                    >
                      View More
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">({allForTab.length - visibleCount} remaining)</span>
                    </Button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
      </div>
    </>
  );
}

/* ─── Helpers ──────────────────────────────────────────── */

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}