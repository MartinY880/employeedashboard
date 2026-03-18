// ProConnect — useMyShareFeed Hook
// Data fetching + mutations for the myshare social feed

"use client";

import { useState, useEffect, useCallback } from "react";
import type { MySharePost, MyShareComment } from "@/types";

export function useMyShareFeed() {
  const [posts, setPosts] = useState<MySharePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchPosts = useCallback(async (cursor?: string) => {
    try {
      const url = cursor
        ? `/api/myshare-feed?cursor=${cursor}`
        : "/api/myshare-feed";
      const res = await fetch(url);
      const data = await res.json();

      if (cursor) {
        setPosts((prev) => [...prev, ...(data.posts || [])]);
      } else {
        setPosts(data.posts || []);
      }
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      console.error("Failed to fetch myshare posts:", err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    await fetchPosts(nextCursor);
  }, [nextCursor, isLoadingMore, fetchPosts]);

  const createPost = useCallback(
    async (caption: string, media: { fileUrl: string; mimeType: string; fileSize: number }[]) => {
      const res = await fetch("/api/myshare-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, media }),
      });

      if (!res.ok) throw new Error("Failed to create post");
      const data = await res.json();
      setPosts((prev) => [data.post, ...prev]);
      return data.post;
    },
    [],
  );

  const deletePost = useCallback(async (postId: string) => {
    const res = await fetch(`/api/myshare-feed?id=${postId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete post");
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const toggleLike = useCallback(async (postId: string) => {
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              userLiked: !p.userLiked,
              likeCount: p.likeCount + (p.userLiked ? -1 : 1),
            }
          : p,
      ),
    );

    try {
      await fetch(`/api/myshare-feed/${postId}/like`, { method: "POST" });
    } catch {
      // Revert on failure
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                userLiked: !p.userLiked,
                likeCount: p.likeCount + (p.userLiked ? -1 : 1),
              }
            : p,
        ),
      );
    }
  }, []);

  const uploadMedia = useCallback(async (files: File[]) => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));

    const res = await fetch("/api/myshare-feed/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Failed to upload media");
    const data = await res.json();
    return data.media as { fileUrl: string; mimeType: string; fileSize: number }[];
  }, []);

  // Comments
  const fetchComments = useCallback(async (postId: string) => {
    const res = await fetch(`/api/myshare-feed/${postId}/comments`);
    const data = await res.json();
    return (data.comments || []) as MyShareComment[];
  }, []);

  const addComment = useCallback(
    async (postId: string, content: string, parentId?: string) => {
      const res = await fetch(`/api/myshare-feed/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parentId: parentId || null }),
      });

      if (!res.ok) throw new Error("Failed to add comment");

      const data = await res.json();
      const newComment = data.comment as MyShareComment;

      // Update comment count (preview stays showing oldest comments)
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const updated = { ...p, commentCount: p.commentCount + 1 };
          // Only add to preview if it's a top-level comment and preview isn't full yet
          if (!parentId && (p.previewComments?.length ?? 0) < 5) {
            updated.previewComments = [
              ...(p.previewComments || []),
              { id: newComment.id, authorName: newComment.authorName, authorEmail: newComment.authorEmail, content: newComment.content },
            ];
          }
          return updated;
        }),
      );

      return newComment;
    },
    [],
  );

  const toggleCommentLike = useCallback(
    async (postId: string, commentId: string) => {
      await fetch(`/api/myshare-feed/${postId}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
    },
    [],
  );

  const deleteComment = useCallback(
    async (postId: string, commentId: string) => {
      const res = await fetch(
        `/api/myshare-feed/${postId}/comments?id=${commentId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete comment");

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            commentCount: Math.max(0, p.commentCount - 1),
            previewComments: (p.previewComments || []).filter((c) => c.id !== commentId),
          };
        }),
      );
    },
    [],
  );

  return {
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
  };
}
