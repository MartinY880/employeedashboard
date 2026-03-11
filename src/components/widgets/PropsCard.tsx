// ProConnect — Props Card Widget (Gamified)
// Award-style praise card: badge ribbon, author → recipient, message, reactions
// Each praise feels like a collectible achievement

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSounds } from "@/components/shared/SoundProvider";
import { motion } from "framer-motion";
import { AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, ChevronDown, Reply, X, Trash2, ThumbsUp, Send } from "lucide-react";
import type { PropsComment } from "@/types";

/* ─── Badge Definitions ────────────────────────────────── */

export const PRAISE_BADGES = [
  {
    key: "mvp",
    label: "MVP",
    emoji: "🏆",
    emojiScale: "scale-110",
    gradient: "from-amber-400 to-yellow-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    glow: "shadow-amber-200/40",
    desc: "Most Valuable Player",
  },
  {
    key: "rockstar",
    label: "Rockstar",
    emoji: "🎸",
    emojiScale: "scale-110",
    gradient: "from-purple-500 to-pink-500",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-200 dark:border-purple-800",
    glow: "shadow-purple-200/40",
    desc: "Absolute legend",
  },
  {
    key: "brainiac",
    label: "Brainiac",
    emoji: "🧠",
    emojiScale: "scale-110",
    gradient: "from-blue-500 to-cyan-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    glow: "shadow-blue-200/40",
    desc: "Big brain energy",
  },
  {
    key: "heart",
    label: "Big Heart",
    emoji: "💖",
    emojiScale: "scale-100",
    gradient: "from-pink-400 to-rose-500",
    bg: "bg-pink-50 dark:bg-pink-950/40",
    border: "border-pink-200 dark:border-pink-800",
    glow: "shadow-pink-200/40",
    desc: "Goes above & beyond",
  },
  {
    key: "fire",
    label: "On Fire",
    emoji: "🔥",
    emojiScale: "scale-100",
    gradient: "from-orange-500 to-red-500",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-800",
    glow: "shadow-orange-200/40",
    desc: "Unstoppable streak",
  },
  {
    key: "teamplayer",
    label: "Team Player",
    emoji: "🤝",
    emojiScale: "scale-100",
    gradient: "from-emerald-400 to-teal-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    glow: "shadow-emerald-200/40",
    desc: "Strongest together",
  },
] as const;

export type PraiseBadgeKey = (typeof PRAISE_BADGES)[number]["key"];

export function getBadge(key: string | undefined) {
  return PRAISE_BADGES.find((b) => b.key === key) || PRAISE_BADGES[0];
}

/* ─── Reactions ────────────────────────────────────────── */

const REACTIONS = [
  { key: "highfive", emoji: "🙌", label: "High Five", activeBg: "bg-amber-100 dark:bg-amber-900/50", activeBorder: "border-amber-300 dark:border-amber-700", ring: "ring-amber-200 dark:ring-amber-700/60" },
  { key: "uplift", emoji: "🚀", label: "Uplift", activeBg: "bg-blue-100 dark:bg-blue-900/50", activeBorder: "border-blue-300 dark:border-blue-700", ring: "ring-blue-200 dark:ring-blue-700/60" },
  { key: "bomb", emoji: "💣", label: "Bomb", activeBg: "bg-red-100 dark:bg-red-900/50", activeBorder: "border-red-300 dark:border-red-700", ring: "ring-red-200 dark:ring-red-700/60" },
] as const;

type ReactionKey = (typeof REACTIONS)[number]["key"];

const CHIP_BASE_CLASS = "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 py-0 text-[11px] font-medium shadow-sm transition-all";
const CHIP_IDLE_CLASS = "border-gray-200/80 dark:border-gray-700/80 bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:border-brand-blue/30 hover:bg-white dark:hover:bg-gray-800";

function CommentBubble({
  comment,
  onDelete,
  onLike,
  onReplyClick,
  isReply = false,
}: {
  comment: PropsComment;
  onDelete: (id: string) => void;
  onLike: (id: string) => void;
  onReplyClick?: (id: string, authorName: string) => void;
  isReply?: boolean;
}) {
  return (
    <div className={isReply ? "ml-8" : ""}>
      <div className="group/comment flex gap-2 items-start">
        <div className={`shrink-0 rounded-full bg-gradient-to-br from-brand-blue/70 to-brand-blue flex items-center justify-center text-white font-bold ${isReply ? "w-6 h-6 text-[9px]" : "w-7 h-7 text-[10px]"}`}>
          {comment.authorName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="inline-block bg-gray-100 dark:bg-gray-800 rounded-2xl px-3 py-1.5 max-w-[90%]">
            <span className="font-semibold text-[12px] text-gray-800 dark:text-gray-200 block leading-tight">{comment.authorName}</span>
            <p className="text-[12px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed mt-0.5">{comment.content}</p>
          </div>
          <div className="flex items-center gap-2.5 mt-0.5 ml-2 text-[11px]">
            <button
              type="button"
              onClick={() => onLike(comment.id)}
              className={`font-semibold transition-colors ${comment.userLiked ? "text-brand-blue" : "text-gray-400 dark:text-gray-500 hover:text-brand-blue"}`}
            >
              {comment.likes > 0 ? (
                <span className="flex items-center gap-0.5">
                  <ThumbsUp className={`w-3 h-3 ${comment.userLiked ? "fill-brand-blue" : ""}`} />
                  {comment.likes}
                </span>
              ) : (
                "Like"
              )}
            </button>
            {!isReply && onReplyClick && (
              <button
                type="button"
                onClick={() => onReplyClick(comment.id, comment.authorName)}
                className="font-semibold text-gray-400 dark:text-gray-500 hover:text-brand-blue transition-colors"
              >
                Reply
              </button>
            )}
            <span className="text-gray-400 dark:text-gray-500">{getRelativeTime(comment.createdAt)}</span>
            {comment.canDelete && (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="opacity-0 group-hover/comment:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PropsCommentThread({
  propsId,
  commentCount = 0,
  inline = false,
}: {
  propsId: string;
  commentCount?: number;
  inline?: boolean;
}) {
  const [comments, setComments] = useState<PropsComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [localCount, setLocalCount] = useState(commentCount);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const { playClick, playSuccess } = useSounds();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalCount(commentCount);
  }, [commentCount]);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/props/comments?propsId=${propsId}`);
      const data = await res.json();
      setComments(data.comments || []);
      const total = (data.comments || []).reduce(
        (acc: number, c: PropsComment) => acc + 1 + (c.replies?.length ?? 0),
        0
      );
      setLocalCount(total || commentCount);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [propsId, commentCount]);

  useEffect(() => {
    if (expanded && !loaded) void fetchComments();
  }, [expanded, loaded, fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/props/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propsId,
          content: newComment.trim(),
          parentId: replyTo?.id || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (replyTo) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === replyTo.id
                ? { ...c, replies: [...(c.replies || []), data.comment] }
                : c
            )
          );
        } else {
          setComments((prev) => [...prev, data.comment]);
        }
        setLocalCount((c) => c + 1);
        setNewComment("");
        setReplyTo(null);
        playSuccess();
      }
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const res = await fetch(`/api/props/comments?id=${commentId}`, { method: "DELETE" });
      if (res.ok) {
        const wasTopLevel = comments.some((c) => c.id === commentId);
        if (wasTopLevel) {
          const removed = comments.find((c) => c.id === commentId);
          const removedCount = 1 + (removed?.replies?.length ?? 0);
          setComments((prev) => prev.filter((c) => c.id !== commentId));
          setLocalCount((c) => Math.max(0, c - removedCount));
        } else {
          setComments((prev) =>
            prev.map((c) => ({
              ...c,
              replies: (c.replies || []).filter((r) => r.id !== commentId),
            }))
          );
          setLocalCount((c) => Math.max(0, c - 1));
        }
      }
    } catch {
      // silent
    }
  };

  const handleLike = async (commentId: string) => {
    playClick();
    const updateLike = (list: PropsComment[]): PropsComment[] =>
      list.map((c) => {
        if (c.id === commentId) {
          const liked = !c.userLiked;
          return { ...c, userLiked: liked, likes: c.likes + (liked ? 1 : -1) };
        }
        return { ...c, replies: updateLike(c.replies || []) };
      });

    setComments(updateLike);

    try {
      await fetch("/api/props/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
    } catch {
      setComments(updateLike);
    }
  };

  const handleReplyClick = (parentId: string, authorName: string) => {
    setReplyTo({ id: parentId, name: authorName });
    inputRef.current?.focus();
  };

  const toggleButton = (
    <motion.button
      type="button"
      onClick={() => {
        playClick();
        setExpanded((prev) => !prev);
      }}
      animate={expanded ? { scale: 1.04 } : { scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`${CHIP_BASE_CLASS} whitespace-nowrap font-semibold ${
        expanded
          ? "border-brand-blue/40 bg-brand-blue/10 text-brand-blue ring-1 ring-brand-blue/20 dark:border-brand-blue/40 dark:bg-brand-blue/15 dark:text-brand-blue dark:ring-brand-blue/30"
          : `${CHIP_IDLE_CLASS} hover:text-brand-blue dark:hover:text-brand-blue`
      } ${inline ? "justify-self-end" : "mx-auto"}`}
    >
      <MessageCircle className="w-3 h-3 shrink-0" />
      <span className={`tabular-nums text-[10px] font-bold leading-none ${expanded ? "text-brand-blue" : "text-gray-700 dark:text-gray-200"}`}>
        {localCount}
      </span>
      <span className="whitespace-nowrap leading-none">
        {localCount === 1 ? "Comment" : "Comments"}
      </span>
      <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
    </motion.button>
  );

  const commentsPanel = (
    <AnimatePresence>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`overflow-hidden ${inline ? "col-span-2" : ""}`}
        >
          <div className={`space-y-2 ${inline ? "pt-1" : "pt-2"}`}>
              {loading ? (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </div>
              ) : comments.length === 0 && loaded ? (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">No comments yet — be the first!</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id}>
                    <CommentBubble
                      comment={c}
                      onDelete={handleDelete}
                      onLike={handleLike}
                      onReplyClick={handleReplyClick}
                    />
                    {(c.replies || []).map((r) => (
                      <div key={r.id} className="mt-1.5">
                        <CommentBubble
                          comment={r}
                          onDelete={handleDelete}
                          onLike={handleLike}
                          isReply
                        />
                      </div>
                    ))}
                  </div>
                ))
              )}

              {replyTo && (
                <div className="flex items-center gap-1.5 text-[11px] text-brand-blue ml-1">
                  <Reply className="w-3 h-3" />
                  <span>Replying to <strong>{replyTo.name}</strong></span>
                  <button type="button" onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex gap-1.5 items-center">
                <div className="shrink-0 w-6 h-6 rounded-full bg-brand-blue/20 dark:bg-brand-blue/30 flex items-center justify-center">
                  <MessageCircle className="w-3 h-3 text-brand-blue" />
                </div>
                <Input
                  ref={inputRef}
                  placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Write a comment…"}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="h-7 text-[11px] bg-gray-50 dark:bg-gray-900 dark:border-gray-700 border-gray-200 rounded-full flex-1 px-3"
                  maxLength={500}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newComment.trim() || sending}
                  className="h-7 w-7 p-0 rounded-full bg-brand-blue hover:bg-brand-blue/90 text-white"
                >
                  {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                </Button>
              </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (inline) {
    return (
      <>
        {toggleButton}
        {commentsPanel}
      </>
    );
  }

  return (
    <div className="mt-3 pl-9">
      {toggleButton}
      {commentsPanel}
    </div>
  );
}

/* ─── Props Interface ──────────────────────────────────── */

interface PropsCardProps {
  id?: string;
  authorName: string;
  authorInitials: string;
  authorPhotoUrl?: string;
  recipientName: string;
  message: string;
  likes: number;
  reactions?: Record<ReactionKey, number>;
  myReactions?: ReactionKey[];
  onReact?: (reaction: ReactionKey) => Promise<void>;
  createdAt: string;
  badge?: string;
  commentCount?: number;
}

/* ─── Component ────────────────────────────────────────── */

export function PropsCard({
  id,
  authorName,
  authorInitials,
  authorPhotoUrl,
  recipientName,
  message,
  likes,
  reactions: reactionCounts,
  myReactions: currentUserReactions,
  onReact,
  createdAt,
  badge: badgeKey,
  commentCount,
}: PropsCardProps) {
  const { playPop } = useSounds();
  const badge = getBadge(badgeKey);

  const reactions: Record<ReactionKey, number> = reactionCounts || {
    highfive: likes,
    uplift: 0,
    bomb: 0,
  };
  const myReactions = new Set<ReactionKey>(currentUserReactions || []);
  const [poppedReaction, setPoppedReaction] = useState<ReactionKey | null>(null);
  const [isToggling, setIsToggling] = useState<ReactionKey | null>(null);
  const timeAgo = getRelativeTime(createdAt);
  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);

  const handleReaction = async (key: ReactionKey) => {
    if (!onReact || isToggling === key) return;

    setIsToggling(key);
    try {
      await onReact(key);
    } finally {
      setIsToggling(null);
    }

    playPop();
    setPoppedReaction(key);
    setTimeout(() => setPoppedReaction(null), 400);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`relative overflow-hidden rounded-xl border ${badge.border} shadow-sm hover:shadow-md ${badge.glow} transition-all duration-300`}
    >
      {/* Badge Header Ribbon */}
      <div className={`bg-gradient-to-r ${badge.gradient} px-3.5 py-2 flex items-center gap-2`}>
        <span className="h-5 w-5 inline-flex items-center justify-center">
          <span className={`text-lg leading-none drop-shadow-sm ${badge.emojiScale}`}>{badge.emoji}</span>
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-[11px] uppercase tracking-wider leading-none">
            {badge.label}
          </div>
          <div className="text-white/70 text-[9px] leading-tight mt-0.5">{badge.desc}</div>
        </div>
        {totalReactions > 0 && (
          <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
            <span className="text-white text-[10px] font-bold tabular-nums">{totalReactions}</span>
            <span className="text-white/80 text-[9px]">✦</span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className={`${badge.bg} p-3.5`}>
        {/* Author → Recipient */}
        <div className="flex items-center gap-2 mb-2.5">
          <Avatar className="h-7 w-7 shrink-0 ring-2 ring-white shadow-sm">
            {authorPhotoUrl && (
              <AvatarImage src={authorPhotoUrl} alt={authorName} />
            )}
            <AvatarFallback className="bg-brand-blue/10 text-brand-blue text-[9px] font-bold">
              {authorInitials}
            </AvatarFallback>
          </Avatar>
          <div className="text-xs min-w-0 flex-1">
            <span className="font-bold text-gray-800 dark:text-gray-200">{authorName}</span>
            <span className="text-gray-400 dark:text-gray-500 mx-1">→</span>
            <span className="font-bold text-brand-blue">@{recipientName}</span>
          </div>
          <span className="text-[10px] text-gray-400 shrink-0">{timeAgo}</span>
        </div>

        {/* Message */}
        <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed mb-3 pl-9 italic">
          &ldquo;{message}&rdquo;
        </p>

        <div className="mt-1 border-t border-white/60 pt-3 pl-8 sm:pl-9 dark:border-gray-700/70">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2">
            <div className="flex min-w-0 items-center gap-1">
            {REACTIONS.map((r) => {
              const isActive = myReactions.has(r.key);
              const count = reactions[r.key];
              const isPopping = poppedReaction === r.key;
              return (
                <motion.button
                  key={r.key}
                  onClick={() => void handleReaction(r.key)}
                  animate={isPopping ? { scale: [1, 1.35, 1] } : {}}
                  transition={{ duration: 0.3 }}
                  disabled={isToggling === r.key}
                  className={`${CHIP_BASE_CLASS} ${
                    isActive
                      ? `${r.activeBg} ${r.activeBorder} ring-1 ${r.ring} text-gray-800 dark:text-gray-100`
                      : CHIP_IDLE_CLASS
                  }`}
                  title={r.label}
                >
                  <span className="text-[13px] leading-none">{r.emoji}</span>
                  {count > 0 && (
                    <span className={`tabular-nums text-[10px] ${isActive ? "font-bold" : "text-gray-500 dark:text-gray-400"}`}>
                      {count}
                    </span>
                  )}
                </motion.button>
              );
            })}
            </div>

            {id && <PropsCommentThread propsId={id} commentCount={commentCount} inline />}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Helper ───────────────────────────────────────────── */

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
