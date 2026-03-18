// ProConnect — MyShare Feed Widget
// Social feed for employee myshare posts with compose, likes, comments

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  ImageIcon,
  Video,
  Send,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import { useMyShareFeed } from "@/hooks/useMyShareFeed";
import { MySharePostCard } from "./MySharePostCard";
import { useSounds } from "@/components/shared/SoundProvider";

export function MyShareFeedWidget() {
  const {
    posts,
    isLoading,
    nextCursor,
    isLoadingMore,
    loadMore,
    createPost,
    deletePost,
    toggleLike,
    uploadMedia,
    fetchComments,
    addComment,
    toggleCommentLike,
    deleteComment,
  } = useMyShareFeed();

  const { playClick, playSuccess } = useSounds();
  const [showCompose, setShowCompose] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCount, setShowCount] = useState(4);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.dbUserId) setCurrentUserId(data.dbUserId);
      })
      .catch(() => {});
  }, []);

  // Cleanup preview URLs
  useEffect(() => {
    return () => previewUrls.forEach(URL.revokeObjectURL);
  }, [previewUrls]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const total = selectedFiles.length + files.length;
    if (total > 10) {
      // Only take what fits
      files.splice(10 - selectedFiles.length);
    }

    setSelectedFiles((prev) => [...prev, ...files]);
    setPreviewUrls((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);

    // Reset input so same file can be selected again
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    URL.revokeObjectURL(previewUrls[idx]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePost = async () => {
    if (selectedFiles.length === 0) return;
    setIsSending(true);

    try {
      let media: { fileUrl: string; mimeType: string; fileSize: number }[] = [];

      if (selectedFiles.length > 0) {
        media = await uploadMedia(selectedFiles);
      }

      await createPost(caption.trim(), media);
      playSuccess();

      // Reset form
      setCaption("");
      previewUrls.forEach(URL.revokeObjectURL);
      setSelectedFiles([]);
      setPreviewUrls([]);
      setShowCompose(false);
    } catch {
      // silent
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    setCaption("");
    previewUrls.forEach(URL.revokeObjectURL);
    setSelectedFiles([]);
    setPreviewUrls([]);
    setShowCompose(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
          >
            <div className="p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Compose Toggle */}
      {!showCompose ? (
        <Button
          onClick={() => {
            setShowCompose(true);
            playClick();
            setTimeout(() => textareaRef.current?.focus(), 100);
          }}
          variant="outline"
          className="w-full h-9 text-[12px] font-medium text-gray-500 dark:text-gray-400 border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-blue hover:text-brand-blue dark:hover:border-brand-blue dark:hover:text-brand-blue transition-colors gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Share a moment
        </Button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3.5 space-y-3"
        >
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder="What's on your mind?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="text-[13px] min-h-[60px] resize-none border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg pb-6"
              maxLength={500}
            />
            <span className={`absolute bottom-1.5 right-2.5 text-[10px] ${caption.length >= 450 ? "text-red-500" : "text-gray-400"}`}>
              {caption.length}/500
            </span>
          </div>

          {/* Preview Thumbnails */}
          {previewUrls.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {previewUrls.map((url, i) => (
                <div
                  key={i}
                  className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group"
                >
                  {selectedFiles[i]?.type.startsWith("video/") ? (
                    <video
                      src={url}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="h-7 px-2 text-gray-500 hover:text-brand-blue text-[11px] gap-1"
                disabled={selectedFiles.length >= 10}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Photo / Video
              </Button>
              {selectedFiles.length > 0 && (
                <span className="text-[10px] text-gray-400">
                  {selectedFiles.length}/10
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-7 text-[11px] text-gray-500"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePost}
                disabled={isSending || selectedFiles.length === 0}
                size="sm"
                className="h-7 px-3 text-[11px] bg-brand-blue hover:bg-brand-blue/90 text-white gap-1"
              >
                {isSending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
                Post
              </Button>
            </div>
          </div>

        </motion.div>
      )}

      {/* Feed */}
      {posts.length === 0 && !isLoading ? (
        <div className="text-center py-8">
          <Sparkles className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-[13px] text-gray-400 dark:text-gray-500">
            No posts yet. Be the first to share!
          </p>
        </div>
      ) : (
        <AnimatePresence>
          {posts.slice(0, showCount).map((post) => (
            <MySharePostCard
              key={post.id}
              post={post}
              onLike={() => toggleLike(post.id)}
              onDelete={() => deletePost(post.id)}
              onFetchComments={fetchComments}
              onAddComment={addComment}
              onToggleCommentLike={toggleCommentLike}
              onDeleteComment={deleteComment}
              canDelete={post.authorId === currentUserId}
            />
          ))}
        </AnimatePresence>
      )}

      {/* View More */}
      {(showCount < posts.length || nextCursor) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (showCount + 4 <= posts.length || !nextCursor) {
              setShowCount((prev) => prev + 4);
            } else {
              loadMore();
              setShowCount((prev) => prev + 4);
            }
          }}
          disabled={isLoadingMore}
          className="w-full h-8 text-[11px] font-medium text-gray-500 dark:text-gray-400 border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-blue hover:text-brand-blue dark:hover:border-brand-blue dark:hover:text-brand-blue transition-colors gap-1.5"
        >
          {isLoadingMore ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : null}
          {isLoadingMore ? "Loading…" : "View More"}
        </Button>
      )}
    </div>
  );
}
