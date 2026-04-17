// ProConnect — Shared Comment Section
// Unified comment list, bubble, reply state, and input used across all widgets.

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ThumbsUp,
  Trash2,
  Send,
  Loader2,
  MessageCircle,
  ChevronDown,
  Reply,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MentionInput, type MentionInputHandle } from "@/components/shared/MentionInput";
import { MentionChip, PersonLightbox } from "@/components/shared/ProfileDialog";
import { type DirectoryNode } from "@/hooks/useDirectory";
import { LinkPreviewCard } from "@/components/shared/LinkPreviewCard";
import { useSounds } from "@/components/shared/SoundProvider";
import type { UnifiedComment } from "@/types";

// ─── Mention + Hashtag + Link rendering ─────────────────────

const MENTION_RENDER_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;
const HASHTAG_RENDER_REGEX = /#(\w+)/g;

// URL: http(s)://… , www.… , or bare domain.tld — avoids trailing punctuation
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?"')\]]|[a-zA-Z0-9][a-zA-Z0-9.-]*\.(?:com|org|net|edu|gov|io|co|dev|app|ai|us|uk|ca|de|fr|info|biz|me|tv|cc|xyz)(?:\/[^\s<]*[^\s<.,;:!?"')\]])?/;
// Email: local@domain.tld
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
// Phone: optional +1, optional parens, 10-digit US numbers with common separators
const PHONE_REGEX = /(?:\+1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/;
// Combined for single-pass splitting (order matters: URL before email to avoid partial matches)
const LINK_REGEX = new RegExp(
  `(${URL_REGEX.source}|${EMAIL_REGEX.source}|${PHONE_REGEX.source})`,
  "g",
);

const LINK_CLASSNAME = "text-brand-blue underline decoration-brand-blue/30 hover:decoration-brand-blue/60 transition-colors";

function formatLinkText(raw: string): string {
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname + url.search + url.hash;
    if (path.length <= 1) return host;
    if (path.length > 20) return `${host}/\u2026`;
    return `${host}${path}`;
  } catch {
    return raw.length > 40 ? `${raw.slice(0, 37)}\u2026` : raw;
  }
}

export function renderMentionContent(content: string) {
  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_RENDER_REGEX.source, "g");
  let key = 0;

  // First pass: split by @mentions
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <MentionChip key={`m${key++}`} userId={match[2]} displayName={match[1]} />,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  if (parts.length === 0) return content;

  // Second pass: split remaining text segments by #hashtags
  const finalParts: (string | React.ReactNode)[] = [];
  for (const part of parts) {
    if (typeof part !== "string") {
      finalParts.push(part);
      continue;
    }
    const hashRegex = new RegExp(HASHTAG_RENDER_REGEX.source, "g");
    let hLastIndex = 0;
    let hMatch: RegExpExecArray | null;
    while ((hMatch = hashRegex.exec(part)) !== null) {
      if (hMatch.index > hLastIndex) {
        finalParts.push(part.slice(hLastIndex, hMatch.index));
      }
      finalParts.push(
        <span key={`h${key++}`} className="text-brand-blue font-medium">
          #{hMatch[1]}
        </span>,
      );
      hLastIndex = hMatch.index + hMatch[0].length;
    }
    if (hLastIndex < part.length) {
      finalParts.push(part.slice(hLastIndex));
    } else if (hLastIndex === 0) {
      finalParts.push(part);
    }
  }

  // Third pass: linkify URLs, emails, and phone numbers in remaining text
  const linkedParts: (string | React.ReactNode)[] = [];
  for (const part of finalParts) {
    if (typeof part !== "string") {
      linkedParts.push(part);
      continue;
    }
    const segments = part.split(LINK_REGEX);
    for (const seg of segments) {
      if (!seg) continue;
      if (URL_REGEX.test(seg)) {
        const href = seg.startsWith("http") ? seg : `https://${seg}`;
        linkedParts.push(
          <LinkPreviewCard key={`l${key++}`} url={href} />,
        );
      } else if (EMAIL_REGEX.test(seg)) {
        linkedParts.push(
          <a key={`l${key++}`} href={`mailto:${seg}`} className={LINK_CLASSNAME}>
            {seg}
          </a>,
        );
      } else if (PHONE_REGEX.test(seg)) {
        const digits = seg.replace(/\D/g, "");
        const tel = digits.length === 10 ? `+1${digits}` : `+${digits}`;
        linkedParts.push(
          <a key={`l${key++}`} href={`tel:${tel}`} className={LINK_CLASSNAME}>
            {seg}
          </a>,
        );
      } else {
        linkedParts.push(seg);
      }
    }
  }

  return linkedParts;
}

// ─── Relative time ──────────────────────────────────────────

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}w`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Comment Bubble ─────────────────────────────────────────

function CommentBubble({
  comment,
  onDelete,
  onLike,
  onReplyClick,
  onAuthorClick,
  isReply = false,
}: {
  comment: UnifiedComment;
  onDelete: (id: string) => void;
  onLike: (id: string) => void;
  onReplyClick?: (id: string, authorName: string) => void;
  onAuthorClick?: (name: string) => void;
  isReply?: boolean;
}) {
  return (
    <div className={isReply ? "ml-8" : ""}>
      <div className="group/comment flex gap-2 items-start">
        {/* Avatar circle */}
        <button
          type="button"
          onClick={() => onAuthorClick?.(comment.authorName)}
          className={`shrink-0 rounded-full bg-gradient-to-br from-brand-blue/70 to-brand-blue flex items-center justify-center text-white font-bold cursor-pointer hover:opacity-80 transition-opacity focus:outline-none ${
            isReply ? "w-6 h-6 text-[9px]" : "w-7 h-7 text-[10px]"
          }`}
        >
          {comment.authorName.charAt(0).toUpperCase()}
        </button>
        {/* Bubble */}
        <div className="flex-1 min-w-0">
          <div className="inline-block bg-gray-100 dark:bg-gray-800 rounded-2xl px-3 py-1.5 max-w-[90%]">
            <button type="button" onClick={() => onAuthorClick?.(comment.authorName)} className="font-semibold text-[12px] text-gray-800 dark:text-gray-200 block leading-tight hover:text-brand-blue transition-colors cursor-pointer focus:outline-none">
              {comment.authorName}
            </button>
            <p className="text-[12px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed mt-0.5">
              {renderMentionContent(comment.content)}
            </p>
          </div>
          {/* Actions row: Like · Reply · Time · Delete */}
          <div className="flex items-center gap-2.5 mt-0.5 ml-2 text-[11px]">
            <button
              type="button"
              onClick={() => onLike(comment.id)}
              className={`font-semibold transition-colors ${
                comment.userLiked
                  ? "text-brand-blue"
                  : "text-gray-400 dark:text-gray-500 hover:text-brand-blue"
              }`}
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
            <span className="text-gray-400 dark:text-gray-500">{getTimeAgo(comment.createdAt)}</span>
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

// ─── Comment with replies ───────────────────────────────────

function CommentWithReplies({
  comment,
  onDelete,
  onLike,
  onReplyClick,
  onAuthorClick,
}: {
  comment: UnifiedComment;
  onDelete: (id: string) => void;
  onLike: (id: string) => void;
  onReplyClick: (id: string, authorName: string) => void;
  onAuthorClick?: (name: string) => void;
}) {
  return (
    <div>
      <CommentBubble
        comment={comment}
        onDelete={onDelete}
        onLike={onLike}
        onReplyClick={onReplyClick}
        onAuthorClick={onAuthorClick}
      />
      {(comment.replies || []).map((r) => (
        <div key={r.id} className="mt-1.5">
          <CommentBubble comment={r} onDelete={onDelete} onLike={onLike} onAuthorClick={onAuthorClick} isReply />
        </div>
      ))}
    </div>
  );
}

// ─── Reply indicator ────────────────────────────────────────

function ReplyIndicator({
  replyTo,
  onCancel,
}: {
  replyTo: { id: string; name: string };
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-brand-blue ml-1">
      <Reply className="w-3 h-3" />
      <span>
        Replying to <strong>{replyTo.name}</strong>
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="text-gray-400 hover:text-red-400"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── CommentSection Props ───────────────────────────────────

export interface CommentSectionProps {
  /** Unique entity ID (ideaId, propsId, videoId, postId) */
  entityId: string;
  /** Initial comment count from the parent */
  commentCount?: number;
  /** Max characters for comment input (default 500) */
  charLimit?: number;
  /** Fetch comments for this entity — return array of UnifiedComment */
  onFetchComments: (entityId: string) => Promise<UnifiedComment[]>;
  /** Submit a new comment — return the created comment */
  onSubmit: (entityId: string, content: string, parentId?: string) => Promise<UnifiedComment>;
  /** Toggle like on a comment */
  onLike: (entityId: string, commentId: string) => Promise<void>;
  /** Delete a comment */
  onDelete: (entityId: string, commentId: string) => Promise<void>;
  /** Compact chip toggle (icon + count, no text label) for inline grid usage */
  compact?: boolean;
  /** Show only this many top-level comments initially, with a "View all" link to expand */
  previewCount?: number;
  /** Start the section already expanded (comments load immediately) */
  initiallyExpanded?: boolean;
}

// ─── CommentSection (inline expandable) ─────────────────────

export function CommentSection({
  entityId,
  commentCount = 0,
  charLimit = 500,
  onFetchComments,
  onSubmit,
  onLike,
  onDelete,
  compact = false,
  previewCount,
  initiallyExpanded = false,
}: CommentSectionProps) {
  const [comments, setComments] = useState<UnifiedComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(initiallyExpanded && !previewCount);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [localCount, setLocalCount] = useState(commentCount);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [currentUserInitial, setCurrentUserInitial] = useState("");
  const { playClick, playSuccess } = useSounds();
  const inputRef = useRef<MentionInputHandle>(null);
  const [lightboxUser, setLightboxUser] = useState<DirectoryNode | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleAuthorClick = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/directory?mode=flat&search=${encodeURIComponent(name)}`);
      if (!res.ok) return;
      const data = await res.json();
      const people: DirectoryNode[] = data.users || data;
      if (people.length > 0) {
        setLightboxUser(people[0]);
        setLightboxOpen(true);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    setLocalCount(commentCount);
  }, [commentCount]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => { if (d?.name) setCurrentUserInitial(d.name.charAt(0).toUpperCase()); })
      .catch(() => {});
  }, []);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await onFetchComments(entityId);
      setComments(data);
      const total = data.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0);
      setLocalCount(total || commentCount);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [entityId, commentCount, onFetchComments]);

  useEffect(() => {
    if (expanded && !loaded) fetchComments();
  }, [expanded, loaded, fetchComments]);

  // For initiallyExpanded + previewCount, fetch immediately on mount
  useEffect(() => {
    if (initiallyExpanded && previewCount && !loaded) {
      fetchComments();
    }
  }, [initiallyExpanded, previewCount, loaded, fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      const comment = await onSubmit(entityId, newComment.trim(), replyTo?.id);
      if (replyTo) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyTo.id ? { ...c, replies: [...(c.replies || []), comment] } : c,
          ),
        );
      } else {
        setComments((prev) => [...prev, comment]);
      }
      setLocalCount((c) => c + 1);
      setNewComment("");
      setReplyTo(null);
      playSuccess();
    } catch {
      /* silent */
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await onDelete(entityId, commentId);
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
          })),
        );
        setLocalCount((c) => Math.max(0, c - 1));
      }
    } catch {
      /* silent */
    }
  };

  const handleLike = async (commentId: string) => {
    playClick();
    const updateLike = (list: UnifiedComment[]): UnifiedComment[] =>
      list.map((c) => {
        if (c.id === commentId) {
          const liked = !c.userLiked;
          return { ...c, userLiked: liked, likes: c.likes + (liked ? 1 : -1) };
        }
        return { ...c, replies: updateLike(c.replies || []) };
      });
    setComments(updateLike);

    try {
      await onLike(entityId, commentId);
    } catch {
      setComments(updateLike); // revert optimistic
    }
  };

  const handleReplyClick = (id: string, name: string) => {
    setReplyTo({ id, name });
    inputRef.current?.focus();
  };

  return (
    <div className={compact ? "contents" : "mt-3"}>
      {/* ── initiallyExpanded + previewCount: always-visible preview ── */}
      {initiallyExpanded && previewCount ? (
        <>
          {/* Compact chip for grid layouts */}
          {compact && (
            <button
              type="button"
              onClick={() => {
                playClick();
                setExpanded(!expanded);
              }}
              className={`inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full border px-2 py-0 text-[11px] font-medium shadow-sm transition-all ${
                expanded
                  ? "bg-brand-blue/10 text-brand-blue border-brand-blue/30 ring-1 ring-brand-blue/20"
                  : "border-gray-200/80 dark:border-gray-700/80 bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:border-brand-blue/30 hover:bg-white dark:hover:bg-gray-800"
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {localCount > 0 && <span className="tabular-nums text-[10px]">{localCount}</span>}
            </button>
          )}

          {/* "Hide comments" link — shown at top when expanded with more comments than preview (non-compact only) */}
          {!compact && expanded && localCount > previewCount && (
            <button
              type="button"
              onClick={() => {
                playClick();
                setExpanded(false);
              }}
              className="text-[11px] font-medium text-gray-400 dark:text-gray-500 hover:text-brand-blue transition-colors mb-1"
            >
              Hide comments
            </button>
          )}

          {/* Comments display */}
          <div className={compact ? "col-span-full mt-1" : ""}>
            {loading ? (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 pt-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading…
              </div>
            ) : comments.length === 0 && loaded ? null : expanded ? (
              /* Expanded: show ALL comments with ALL replies */
              <div className="space-y-2 pt-1">
                {comments.map((c) => (
                  <CommentWithReplies
                    key={c.id}
                    comment={c}
                    onDelete={handleDelete}
                    onLike={handleLike}
                    onReplyClick={handleReplyClick}
                    onAuthorClick={handleAuthorClick}
                  />
                ))}
              </div>
            ) : (
              /* Collapsed: preview capped at previewCount total including replies */
              <div className="space-y-2 pt-1">
                {(() => {
                  let remaining = previewCount;
                  return comments.map((c) => {
                    if (remaining <= 0) return null;
                    remaining--;
                    const repliesToShow = Math.min((c.replies || []).length, remaining);
                    remaining -= repliesToShow;
                    return (
                      <div key={c.id}>
                        <CommentBubble
                          comment={c}
                          onDelete={handleDelete}
                          onLike={handleLike}
                          onReplyClick={handleReplyClick}
                          onAuthorClick={handleAuthorClick}
                        />
                        {(c.replies || []).slice(0, repliesToShow).map((r) => (
                          <div key={r.id} className="mt-1.5">
                            <CommentBubble comment={r} onDelete={handleDelete} onLike={handleLike} onAuthorClick={handleAuthorClick} isReply />
                          </div>
                        ))}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* "View all X comments" link — shown when collapsed with more comments (non-compact only) */}
          {!compact && !expanded && localCount > previewCount && (
            <button
              type="button"
              onClick={() => {
                playClick();
                setExpanded(true);
              }}
              className="text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors mt-1"
            >
              View all {localCount} comment{localCount !== 1 ? "s" : ""}
            </button>
          )}

          {/* Always-visible comment input */}
          <div className={compact ? "col-span-full" : ""}>
            {replyTo && (
              <ReplyIndicator replyTo={replyTo} onCancel={() => setReplyTo(null)} />
            )}

            <form onSubmit={handleSubmit} className="flex gap-1.5 items-center mt-2">
              <div className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-brand-blue/70 to-brand-blue flex items-center justify-center text-white font-bold text-[9px]">
                {currentUserInitial || <MessageCircle className="w-3 h-3" />}
              </div>
              <MentionInput
                ref={inputRef}
                placeholder={
                  replyTo ? `Reply to ${replyTo.name}…` : "Write a comment…"
                }
                value={newComment}
                onChange={setNewComment}
                maxLength={charLimit}
                className="flex-1 text-[11px] h-7 rounded-full px-3 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newComment.trim() || sending}
                className="h-7 w-7 p-0 rounded-full bg-brand-blue hover:bg-brand-blue/90 text-white shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </Button>
            </form>
          </div>
        </>
      ) : (
      /* ── Standard toggle mode (all other widgets) ── */
      <>
      {/* Toggle button */}
      {compact ? (
        <button
          type="button"
          onClick={() => {
            playClick();
            setExpanded(!expanded);
          }}
          className={`inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full border px-2 py-0 text-[11px] font-medium shadow-sm transition-all ${
            expanded
              ? "bg-brand-blue/10 text-brand-blue border-brand-blue/30 ring-1 ring-brand-blue/20"
              : "border-gray-200/80 dark:border-gray-700/80 bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:border-brand-blue/30 hover:bg-white dark:hover:bg-gray-800"
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {localCount > 0 && <span className="tabular-nums text-[10px]">{localCount}</span>}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            playClick();
            setExpanded(!expanded);
          }}
          className="mx-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-brand-blue hover:border-brand-blue/40 hover:bg-brand-blue/5 dark:hover:text-brand-blue dark:hover:border-brand-blue/40 dark:hover:bg-brand-blue/10 transition-all"
        >
          <MessageCircle className="w-4 h-4" />
          <span>
            {localCount > 0
              ? `${localCount} comment${localCount !== 1 ? "s" : ""}`
              : "Comments"}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      )}

      {/* Expandable section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`overflow-hidden${compact ? " col-span-full" : ""}`}
          >
            <div className="space-y-2 pt-2">
              {loading ? (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </div>
              ) : comments.length === 0 && loaded ? (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">
                  No comments yet — be the first!
                </p>
              ) : (() => {
                const isPreviewMode = !!previewCount && !previewExpanded;
                const visibleComments = isPreviewMode ? comments.slice(0, previewCount) : comments;
                const hiddenCount = comments.length - visibleComments.length;
                return (
                  <>
                    <div
                      className="space-y-2"
                      style={isPreviewMode && hiddenCount > 0 ? {
                        maskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
                        WebkitMaskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
                      } : undefined}
                    >
                      {visibleComments.map((c) => (
                        <CommentWithReplies
                          key={c.id}
                          comment={c}
                          onDelete={handleDelete}
                          onLike={handleLike}
                          onReplyClick={handleReplyClick}
                          onAuthorClick={handleAuthorClick}
                        />
                      ))}
                    </div>
                    {isPreviewMode && hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setPreviewExpanded(true)}
                        className="text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors"
                      >
                        View all {localCount} comment{localCount !== 1 ? "s" : ""}
                      </button>
                    )}
                  </>
                );
              })()}

              {replyTo && (
                <ReplyIndicator replyTo={replyTo} onCancel={() => setReplyTo(null)} />
              )}

              <form onSubmit={handleSubmit} className="flex gap-1.5 items-center">
                <div className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-brand-blue/70 to-brand-blue flex items-center justify-center text-white font-bold text-[9px]">
                  {currentUserInitial || <MessageCircle className="w-3 h-3" />}
                </div>
                <MentionInput
                  ref={inputRef}
                  placeholder={
                    replyTo ? `Reply to ${replyTo.name}…` : "Write a comment…"
                  }
                  value={newComment}
                  onChange={setNewComment}
                  maxLength={charLimit}
                  className="flex-1 text-[11px] h-7 rounded-full px-3 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newComment.trim() || sending}
                  className="h-7 w-7 p-0 rounded-full bg-brand-blue hover:bg-brand-blue/90 text-white shrink-0"
                >
                  {sending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}

      {lightboxUser && (
        <PersonLightbox user={lightboxUser} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}

// ─── CommentSectionList (no toggle, pre-loaded — for sheets/modals) ──

export interface CommentSectionListProps {
  /** Comments already loaded by the parent */
  comments: UnifiedComment[];
  /** Callback when a comment is added locally */
  onCommentsChange: (comments: UnifiedComment[]) => void;
  /** Max characters for comment input (default 500) */
  charLimit?: number;
  onLike: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  /** Reply-to state + input */
  replyTo: { id: string; name: string } | null;
  onReplyClick: (id: string, name: string) => void;
  onCancelReply: () => void;
  /** Loading state */
  loading?: boolean;
  loaded?: boolean;
  /** Empty state text */
  emptyText?: string;
}

export function CommentSectionList({
  comments,
  loading = false,
  loaded = true,
  emptyText = "No comments yet",
  onLike,
  onDelete,
  replyTo,
  onReplyClick,
}: CommentSectionListProps) {
  const [lightboxUser, setLightboxUser] = useState<DirectoryNode | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleAuthorClick = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/directory?mode=flat&search=${encodeURIComponent(name)}`);
      if (!res.ok) return;
      const data = await res.json();
      const people: DirectoryNode[] = data.users || data;
      if (people.length > 0) {
        setLightboxUser(people[0]);
        setLightboxOpen(true);
      }
    } catch { /* silent */ }
  }, []);

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading comments…
        </div>
      ) : comments.length === 0 && loaded ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MessageCircle className="w-10 h-10 text-gray-200 dark:text-gray-700 mb-2" />
          <p className="text-[13px] text-gray-400 dark:text-gray-500 font-semibold">{emptyText}</p>
          <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">Start the conversation</p>
        </div>
      ) : (
        comments.map((c) => (
          <CommentWithReplies
            key={c.id}
            comment={c}
            onDelete={onDelete}
            onLike={onLike}
            onReplyClick={onReplyClick}
            onAuthorClick={handleAuthorClick}
          />
        ))
      )}

      {replyTo && (
        <ReplyIndicator replyTo={replyTo} onCancel={() => {}} />
      )}

      {lightboxUser && (
        <PersonLightbox user={lightboxUser} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}
