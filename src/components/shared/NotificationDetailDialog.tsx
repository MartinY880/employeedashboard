// ProConnect — Notification Detail Dialog
// Shows the source item (Props, Idea, etc.) with its full comment thread inside a dialog

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Award,
  Lightbulb,
  Star,
  MessageCircle,
  PartyPopper,
  Video,
  Bell,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CommentSection, renderMentionContent } from "@/components/shared/CommentSection";
import type { UnifiedComment } from "@/types";

/* ─── Comment thread wrappers (same API pattern as each widget) ─── */

function PropsCommentThread({ propsId }: { propsId: string }) {
  const fetchComments = useCallback(async (entityId: string): Promise<UnifiedComment[]> => {
    const res = await fetch(`/api/props/comments?propsId=${entityId}`);
    const data = await res.json();
    return data.comments || [];
  }, []);
  const submitComment = useCallback(async (entityId: string, content: string, parentId?: string): Promise<UnifiedComment> => {
    const res = await fetch("/api/props/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propsId: entityId, content, parentId: parentId || null }),
    });
    return (await res.json()).comment;
  }, []);
  const likeComment = useCallback(async (_entityId: string, commentId: string) => {
    await fetch("/api/props/comments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId }) });
  }, []);
  const deleteComment = useCallback(async (_entityId: string, commentId: string) => {
    await fetch(`/api/props/comments?id=${commentId}`, { method: "DELETE" });
  }, []);

  return <CommentSection entityId={propsId} initiallyExpanded previewCount={999} onFetchComments={fetchComments} onSubmit={submitComment} onLike={likeComment} onDelete={deleteComment} />;
}

function IdeaCommentThread({ ideaId }: { ideaId: string }) {
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
    return (await res.json()).comment;
  }, []);
  const likeComment = useCallback(async (_entityId: string, commentId: string) => {
    await fetch("/api/ideas/comments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId }) });
  }, []);
  const deleteComment = useCallback(async (_entityId: string, commentId: string) => {
    await fetch(`/api/ideas/comments?id=${commentId}`, { method: "DELETE" });
  }, []);

  return <CommentSection entityId={ideaId} initiallyExpanded previewCount={999} onFetchComments={fetchComments} onSubmit={submitComment} onLike={likeComment} onDelete={deleteComment} />;
}

function CelebrationCommentThread({ celebrationId }: { celebrationId: string }) {
  const fetchComments = useCallback(async (entityId: string): Promise<UnifiedComment[]> => {
    const res = await fetch(`/api/celebrations/comments?celebrationId=${entityId}`);
    const data = await res.json();
    return data.comments || [];
  }, []);
  const submitComment = useCallback(async (entityId: string, content: string, parentId?: string): Promise<UnifiedComment> => {
    const res = await fetch("/api/celebrations/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ celebrationId: entityId, content, parentId: parentId || null }),
    });
    return (await res.json()).comment;
  }, []);
  const likeComment = useCallback(async (_entityId: string, commentId: string) => {
    await fetch("/api/celebrations/comments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId }) });
  }, []);
  const deleteComment = useCallback(async (_entityId: string, commentId: string) => {
    await fetch(`/api/celebrations/comments?id=${commentId}`, { method: "DELETE" });
  }, []);

  return <CommentSection entityId={celebrationId} initiallyExpanded previewCount={999} onFetchComments={fetchComments} onSubmit={submitComment} onLike={likeComment} onDelete={deleteComment} />;
}

function VideoCommentThread({ videoId }: { videoId: string }) {
  const fetchComments = useCallback(async (entityId: string): Promise<UnifiedComment[]> => {
    const res = await fetch(`/api/video-spotlight/comments?videoId=${entityId}`);
    const data = await res.json();
    return data.comments || [];
  }, []);
  const submitComment = useCallback(async (entityId: string, content: string, parentId?: string): Promise<UnifiedComment> => {
    const res = await fetch("/api/video-spotlight/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: entityId, content, parentId: parentId || null }),
    });
    return (await res.json()).comment;
  }, []);
  const likeComment = useCallback(async (_entityId: string, commentId: string) => {
    await fetch("/api/video-spotlight/comments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId }) });
  }, []);
  const deleteComment = useCallback(async (_entityId: string, commentId: string) => {
    await fetch(`/api/video-spotlight/comments?id=${commentId}`, { method: "DELETE" });
  }, []);

  return <CommentSection entityId={videoId} initiallyExpanded previewCount={999} onFetchComments={fetchComments} onSubmit={submitComment} onLike={likeComment} onDelete={deleteComment} />;
}

function MyShareCommentThread({ postId }: { postId: string }) {
  const fetchComments = useCallback(async (entityId: string): Promise<UnifiedComment[]> => {
    const res = await fetch(`/api/myshare-feed/${entityId}/comments`);
    const data = await res.json();
    return data.comments || [];
  }, []);
  const submitComment = useCallback(async (entityId: string, content: string, parentId?: string): Promise<UnifiedComment> => {
    const res = await fetch(`/api/myshare-feed/${entityId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId: parentId || null }),
    });
    return (await res.json()).comment;
  }, []);
  const likeComment = useCallback(async (entityId: string, commentId: string) => {
    await fetch(`/api/myshare-feed/${entityId}/comments?id=${commentId}`, { method: "PATCH" });
  }, []);
  const deleteComment = useCallback(async (entityId: string, commentId: string) => {
    await fetch(`/api/myshare-feed/${entityId}/comments?id=${commentId}`, { method: "DELETE" });
  }, []);

  return <CommentSection entityId={postId} initiallyExpanded previewCount={999} onFetchComments={fetchComments} onSubmit={submitComment} onLike={likeComment} onDelete={deleteComment} />;
}

/* ─── Source card renderers ─── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SourceCard({ source }: { source: any }) {
  switch (source.type) {
    case "props":
      return (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Props</span>
            <span className="text-xs text-gray-400 ml-auto">{timeAgo(source.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm mb-2">
            <span className="font-semibold text-gray-900 dark:text-white">{source.authorName}</span>
            <span className="text-gray-400">→</span>
            <span className="font-semibold text-gray-900 dark:text-white">{source.recipientName}</span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{renderMentionContent(source.content)}</p>
        </div>
      );

    case "idea":
      return (
        <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Be Brilliant Idea</span>
            {source.status && <Badge variant="outline" className="text-xs capitalize">{source.status.toLowerCase().replace("_", " ")}</Badge>}
            <span className="text-xs text-gray-400 ml-auto">{timeAgo(source.createdAt)}</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{source.title}</h3>
          <p className="text-xs text-gray-500 mb-2">by {source.authorName}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{renderMentionContent(source.description)}</p>
        </div>
      );

    case "highlight":
      return (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">Employee Highlight</span>
            <span className="text-xs text-gray-400 ml-auto">{timeAgo(source.createdAt)}</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{source.title}</h3>
          <p className="text-sm text-gray-500">{source.employeeName}</p>
          {source.subtitle && <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">{source.subtitle}</p>}
        </div>
      );

    case "myshare":
      return (
        <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/30 dark:to-fuchsia-950/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">MyShare Post</span>
            <span className="text-xs text-gray-400 ml-auto">{timeAgo(source.createdAt)}</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">by {source.authorName}</p>
          {source.caption && <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">{renderMentionContent(source.caption)}</p>}
          {source.media?.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {source.media.slice(0, 3).map((m: any) =>
                m.mimeType?.startsWith("video") ? (
                  <video key={m.id} src={m.fileUrl} className="h-32 rounded-lg object-cover" controls />
                ) : (
                  <img key={m.id} src={m.fileUrl} alt="" className="h-32 rounded-lg object-cover" />
                )
              )}
            </div>
          )}
        </div>
      );

    case "celebration":
      return (
        <div className="rounded-xl border border-pink-200 dark:border-pink-800 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <PartyPopper className="w-5 h-5 text-pink-500" />
            <span className="text-sm font-semibold text-pink-700 dark:text-pink-400">Celebration</span>
            {source.celebrationType && <Badge variant="outline" className="text-xs capitalize">{source.celebrationType.toLowerCase()}</Badge>}
            <span className="text-xs text-gray-400 ml-auto">{timeAgo(source.createdAt)}</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{source.employeeName}</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">{source.detail}</p>
        </div>
      );

    case "video-spotlight":
      return (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Video className="w-5 h-5 text-rose-500" />
            <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">Video Spotlight</span>
            <span className="text-xs text-gray-400 ml-auto">{timeAgo(source.createdAt)}</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{source.title}</h3>
        </div>
      );

    default:
      return null;
  }
}

/* ─── Source type helpers ─── */

function getSourceIcon(type?: string) {
  switch (type) {
    case "props": return <Award className="w-4 h-4 text-amber-500" />;
    case "idea": return <Lightbulb className="w-4 h-4 text-yellow-500" />;
    case "highlight": return <Star className="w-4 h-4 text-blue-500" />;
    case "myshare": return <MessageCircle className="w-4 h-4 text-purple-500" />;
    case "celebration": return <PartyPopper className="w-4 h-4 text-pink-500" />;
    case "video-spotlight": return <Video className="w-4 h-4 text-rose-500" />;
    default: return <Bell className="w-4 h-4 text-brand-blue" />;
  }
}

function getSourceLabel(type?: string): string {
  switch (type) {
    case "props": return "Props";
    case "idea": return "Be Brilliant Idea";
    case "highlight": return "Employee Highlight";
    case "myshare": return "MyShare Post";
    case "celebration": return "Celebration";
    case "video-spotlight": return "Video Spotlight";
    default: return "Notification";
  }
}

/* ─── Dialog component ─── */

interface NotificationDetailDialogProps {
  notificationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationDetailDialog({ notificationId, open, onOpenChange }: NotificationDetailDialogProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [notification, setNotification] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [source, setSource] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !notificationId) return;

    setLoading(true);
    setError(null);
    setNotification(null);
    setSource(null);

    async function load() {
      try {
        const res = await fetch(`/api/notifications/${notificationId}`);
        if (!res.ok) {
          setError("Notification not found");
          return;
        }
        const data = await res.json();
        setNotification(data.notification);
        setSource(data.source);
      } catch {
        setError("Failed to load notification");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [open, notificationId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] !flex !flex-col p-0 !gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b dark:border-gray-700 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {getSourceIcon(source?.type)}
            {loading ? "Loading..." : getSourceLabel(source?.type)}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-gray-400" />
            </div>
          ) : error || !notification ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Bell className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">{error || "Not found"}</p>
            </div>
          ) : (
            <>
              {/* Source item */}
              {source ? (
                <>
                  <SourceCard source={source} />

                  {/* Centered comment divider */}
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <span className="text-xs text-gray-400 flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" />
                      Comments
                    </span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  </div>

                  {/* Comment thread */}
                  <div className="-mt-1">
                    {source.type === "props" && <PropsCommentThread propsId={source.id} />}
                    {source.type === "idea" && <IdeaCommentThread ideaId={source.id} />}
                    {source.type === "celebration" && <CelebrationCommentThread celebrationId={source.id} />}
                    {source.type === "video-spotlight" && <VideoCommentThread videoId={source.id} />}
                    {source.type === "myshare" && <MyShareCommentThread postId={source.id} />}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-6 text-center text-gray-400 text-sm">
                  The original item is no longer available.
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
