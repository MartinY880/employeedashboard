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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useIdeas } from "@/hooks/useIdeas";
import { useSounds } from "@/components/shared/SoundProvider";
import type { Idea } from "@/types";

const TRENDING_THRESHOLD = 15;

/* ─── Compact Idea Card ────────────────────────────────── */

function IdeaCard({
  idea,
  onVote,
  userVote,
  isTrending,
}: {
  idea: Idea;
  onVote: (id: string, dir: "up" | "down") => void;
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
      className={`group flex items-start gap-3 p-3 rounded-lg border transition-all hover:shadow-sm ${
        isTrending
          ? "border-orange-200 bg-gradient-to-r from-orange-50/60 to-amber-50/40 hover:border-orange-300"
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
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate leading-tight">
            {idea.title}
          </span>
          {isTrending && (
            <span className="shrink-0 text-xs" title="Trending!">
              🔥
            </span>
          )}
        </div>
        <p className="text-xs text-brand-grey line-clamp-2 leading-relaxed mb-1.5">
          {idea.description}
        </p>
        <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
          <span className="font-medium text-gray-500 dark:text-gray-400">{idea.authorName}</span>
          <span>·</span>
          <span>{timeAgo}</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Selected Idea (Compact Row) ──────────────────────── */

function SelectedIdeaRow({ idea }: { idea: Idea }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2.5 py-2 px-3 rounded-lg bg-emerald-50/60 border border-emerald-100"
    >
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 shrink-0">
        <Rocket className="w-3 h-3 text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate block">
          {idea.title}
        </span>
      </div>
      <Badge
        variant="secondary"
        className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 font-semibold shrink-0"
      >
        Selected
      </Badge>
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
      <Textarea
        placeholder="Brief description..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="text-sm bg-white dark:bg-gray-900 dark:border-gray-700 min-h-[60px] resize-none"
        maxLength={500}
        rows={2}
      />
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
  const { ideas, isLoading, submitIdea, voteIdea, userVotesByIdea } = useIdeas();
  const { playSuccess, playClick } = useSounds();
  const [showForm, setShowForm] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

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

  const handleVote = useCallback(
    async (id: string, dir: "up" | "down") => {
      const didVote = await voteIdea(id, dir);
      if (didVote) {
        triggerDebouncedSort();
      }
    },
    [voteIdea, triggerDebouncedSort]
  );

  const activeIdeas = ideas.filter((i) => i.status === "ACTIVE");

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

  const trendingIdeas = orderedActive
    .filter((i) => i.votes >= TRENDING_THRESHOLD)
    .slice(0, 3);
  const freshIdeas = orderedActive
    .filter((i) => i.votes < TRENDING_THRESHOLD);
  const selectedIdeas = ideas
    .filter((i) => i.status === "SELECTED")
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 3);

  const handleSubmit = async (title: string, description: string) => {
    await submitIdea(title, description);
    playSuccess();
    setShowForm(false);
    setJustSubmitted(true);
    setTimeout(() => setJustSubmitted(false), 3000);
  };

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

      {/* Submit Button */}
      <AnimatePresence mode="wait">
        {!showForm ? (
          <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
          <SubmitIdeaForm
            key="form"
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      {/* 🔥 Trending Now */}
      {trendingIdeas.length > 0 && (
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
              {trendingIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onVote={handleVote}
                  userVote={userVotesByIdea[idea.id]}
                  isTrending
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* ✨ Fresh Ideas */}
      {freshIdeas.length > 0 && (
        <section>
          <h4 className="text-[11px] font-bold text-brand-blue uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Fresh Ideas
          </h4>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {freshIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onVote={handleVote}
                  userVote={userVotesByIdea[idea.id]}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* 🚀 Selected for Implementation */}
      {selectedIdeas.length > 0 && (
        <section>
          <h4 className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Rocket className="w-3.5 h-3.5" />
            Selected
          </h4>
          <div className="space-y-1.5">
            {selectedIdeas.map((idea) => (
              <SelectedIdeaRow key={idea.id} idea={idea} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {activeIdeas.length === 0 && selectedIdeas.length === 0 && (
        <div className="text-center py-6">
          <Lightbulb className="w-8 h-8 text-brand-grey/30 mx-auto mb-2" />
          <p className="text-sm text-brand-grey">No ideas yet — be the first!</p>
        </div>
      )}
    </div>
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
