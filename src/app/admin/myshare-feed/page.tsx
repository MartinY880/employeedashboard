// ProConnect — Admin MyShare Feed Management
// View and delete social feed posts and comments

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  MessageCircle,
  Heart,
  ImageIcon,
  ChevronDown,
  ChevronRight,
  Search,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useSounds } from "@/components/shared/SoundProvider";

interface AdminComment {
  id: string;
  authorName: string;
  authorEmail: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  deletedAt: string | null;
}

interface AdminPost {
  id: string;
  authorName: string;
  authorEmail: string;
  caption: string | null;
  mediaCount: number;
  mediaPreview: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  deletedAt: string | null;
  comments: AdminComment[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminMyShareFeedPage() {
  const { playClick, playSuccess } = useSounds();
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "post" | "comment"; id: string; postId?: string; label: string; hard?: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/myshare-feed");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPosts(data.posts || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      let res: Response;
      if (deleteTarget.hard) {
        // Hard delete via admin API
        const param = deleteTarget.type === "post"
          ? `postId=${deleteTarget.id}`
          : `commentId=${deleteTarget.id}`;
        res = await fetch(`/api/admin/myshare-feed?${param}`, { method: "DELETE" });
      } else {
        // Soft delete via regular API
        if (deleteTarget.type === "post") {
          res = await fetch(`/api/myshare-feed?id=${deleteTarget.id}`, { method: "DELETE" });
        } else {
          res = await fetch(`/api/myshare-feed/${deleteTarget.postId}/comments?id=${deleteTarget.id}`, { method: "DELETE" });
        }
      }
      if (!res.ok) throw new Error();
      playSuccess();

      if (deleteTarget.hard) {
        // Hard delete: remove from list entirely
        if (deleteTarget.type === "post") {
          setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        } else {
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === deleteTarget.postId) {
                return {
                  ...p,
                  comments: p.comments.filter((c) => c.id !== deleteTarget.id),
                  commentCount: p.commentCount - 1,
                };
              }
              return p;
            }),
          );
        }
      } else {
        // Soft delete: mark as deleted in the local state
        if (deleteTarget.type === "post") {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === deleteTarget.id ? { ...p, deletedAt: new Date().toISOString() } : p,
            ),
          );
        } else {
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === deleteTarget.postId) {
                return {
                  ...p,
                  comments: p.comments.map((c) =>
                    c.id === deleteTarget.id ? { ...c, deletedAt: new Date().toISOString() } : c,
                  ),
                };
              }
              return p;
            }),
          );
        }
      }
    } catch {
      // silent
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleRestore = async (type: "post" | "comment", id: string, postId?: string) => {
    setRestoring(id);
    try {
      const body = type === "post" ? { postId: id } : { commentId: id };
      const res = await fetch("/api/admin/myshare-feed", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      playSuccess();

      if (type === "post") {
        setPosts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, deletedAt: null } : p)),
        );
      } else {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id === postId) {
              return {
                ...p,
                comments: p.comments.map((c) =>
                  c.id === id ? { ...c, deletedAt: null } : c,
                ),
              };
            }
            return p;
          }),
        );
      }
    } catch {
      // silent
    } finally {
      setRestoring(null);
    }
  };

  const filtered = posts.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.authorName.toLowerCase().includes(q) ||
      p.authorEmail.toLowerCase().includes(q) ||
      (p.caption || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 hover:text-brand-blue">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">MyShare Feed Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {posts.length} post{posts.length !== 1 && "s"} · {posts.reduce((a, p) => a + p.commentCount, 0)} comment{posts.reduce((a, p) => a + p.commentCount, 0) !== 1 && "s"}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by author or caption…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Posts Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading posts…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">{search ? "No posts match your search." : "No myshare posts yet."}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-800">
                <TableHead className="w-10" />
                <TableHead className="text-xs">Author</TableHead>
                <TableHead className="text-xs">Caption</TableHead>
                <TableHead className="text-xs text-center w-20">Media</TableHead>
                <TableHead className="text-xs text-center w-20">Likes</TableHead>
                <TableHead className="text-xs text-center w-24">Comments</TableHead>
                <TableHead className="text-xs w-40">Date</TableHead>
                <TableHead className="text-xs w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  expanded={expandedPost === post.id}
                  restoringId={restoring}
                  onToggle={() => {
                    playClick();
                    setExpandedPost(expandedPost === post.id ? null : post.id);
                  }}
                  onSoftDeletePost={() =>
                    setDeleteTarget({
                      type: "post",
                      id: post.id,
                      label: `post by ${post.authorName}`,
                    })
                  }
                  onHardDeletePost={() =>
                    setDeleteTarget({
                      type: "post",
                      id: post.id,
                      label: `post by ${post.authorName}`,
                      hard: true,
                    })
                  }
                  onRestorePost={() => handleRestore("post", post.id)}
                  onSoftDeleteComment={(c) =>
                    setDeleteTarget({
                      type: "comment",
                      id: c.id,
                      postId: post.id,
                      label: `comment by ${c.authorName}`,
                    })
                  }
                  onHardDeleteComment={(c) =>
                    setDeleteTarget({
                      type: "comment",
                      id: c.id,
                      postId: post.id,
                      label: `comment by ${c.authorName}`,
                      hard: true,
                    })
                  }
                  onRestoreComment={(c) => handleRestore("comment", c.id, post.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {deleteTarget?.hard && <AlertTriangle className="w-5 h-5 text-red-500" />}
              {deleteTarget?.hard ? "Permanently delete" : "Delete"} {deleteTarget?.type}?
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.hard
                ? `This will PERMANENTLY remove the ${deleteTarget?.label} from the database. This cannot be undone.`
                : `This will soft-delete the ${deleteTarget?.label}. It will be hidden from users but can be restored later.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {deleteTarget?.hard ? "Permanently Delete" : "Soft Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Post Row with expandable comments ────────────────── */

function PostRow({
  post,
  expanded,
  restoringId,
  onToggle,
  onSoftDeletePost,
  onHardDeletePost,
  onRestorePost,
  onSoftDeleteComment,
  onHardDeleteComment,
  onRestoreComment,
}: {
  post: AdminPost;
  expanded: boolean;
  restoringId: string | null;
  onToggle: () => void;
  onSoftDeletePost: () => void;
  onHardDeletePost: () => void;
  onRestorePost: () => void;
  onSoftDeleteComment: (c: AdminComment) => void;
  onHardDeleteComment: (c: AdminComment) => void;
  onRestoreComment: (c: AdminComment) => void;
}) {
  const isDeleted = !!post.deletedAt;

  return (
    <>
      <TableRow className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${isDeleted ? "opacity-50" : ""}`}>
        <TableCell>
          {post.commentCount > 0 && (
            <button onClick={onToggle} className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
        </TableCell>
        <TableCell>
          <div>
            <p className={`text-sm font-medium text-gray-900 dark:text-gray-100 ${isDeleted ? "line-through" : ""}`}>{post.authorName}</p>
            <p className="text-[11px] text-gray-400">{post.authorEmail}</p>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {isDeleted && (
              <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">Deleted</Badge>
            )}
            <p className={`text-sm text-gray-700 dark:text-gray-300 line-clamp-2 max-w-xs ${isDeleted ? "line-through" : ""}`}>
              {post.caption || <span className="text-gray-400 italic">No caption</span>}
            </p>
          </div>
        </TableCell>
        <TableCell className="text-center">
          {post.mediaCount > 0 ? (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <ImageIcon className="w-3 h-3" /> {post.mediaCount}
            </Badge>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </TableCell>
        <TableCell className="text-center">
          {post.likeCount > 0 ? (
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
              <Heart className="w-3.5 h-3.5 text-rose-400" /> {post.likeCount}
            </span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </TableCell>
        <TableCell className="text-center">
          {post.commentCount > 0 ? (
            <button
              onClick={onToggle}
              className="text-sm font-medium text-brand-blue hover:underline flex items-center justify-center gap-1 mx-auto"
            >
              <MessageCircle className="w-3.5 h-3.5" /> {post.commentCount}
            </button>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </TableCell>
        <TableCell>
          <span className="text-xs text-gray-500">{formatDate(post.createdAt)}</span>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            {isDeleted ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRestorePost}
                  disabled={restoringId === post.id}
                  className="h-7 w-7 p-0 text-gray-400 hover:text-green-600"
                  title="Restore"
                >
                  {restoringId === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onHardDeletePost}
                  className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                  title="Permanently delete"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSoftDeletePost}
                className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                title="Soft delete"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded comments */}
      <AnimatePresence>
        {expanded && post.comments.length > 0 && (
          <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <td colSpan={8} className="p-0">
              <div className="bg-gray-50 dark:bg-gray-800/50 border-y border-gray-100 dark:border-gray-700 px-6 py-3">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Comments ({post.comments.length})
                </p>
                <div className="space-y-2">
                  {post.comments.map((c) => {
                    const cDeleted = !!c.deletedAt;
                    return (
                      <div
                        key={c.id}
                        className={`flex items-start gap-3 py-2 px-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 ${c.parentId ? "ml-8" : ""} ${cDeleted ? "opacity-50" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[12px] font-semibold text-gray-900 dark:text-gray-100 ${cDeleted ? "line-through" : ""}`}>
                              {c.authorName}
                            </span>
                            {c.parentId && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">reply</Badge>
                            )}
                            {cDeleted && (
                              <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Deleted</Badge>
                            )}
                            <span className="text-[10px] text-gray-400">
                              {formatDate(c.createdAt)}
                            </span>
                          </div>
                          <p className={`text-[12px] text-gray-700 dark:text-gray-300 ${cDeleted ? "line-through" : ""}`}>{c.content}</p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {cDeleted ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRestoreComment(c)}
                                disabled={restoringId === c.id}
                                className="h-6 w-6 p-0 text-gray-400 hover:text-green-600"
                                title="Restore"
                              >
                                {restoringId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onHardDeleteComment(c)}
                                className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                                title="Permanently delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onSoftDeleteComment(c)}
                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                              title="Soft delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}
