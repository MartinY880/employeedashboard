// ProConnect — Admin Props Management Page
// List all props with ability to delete inappropriate messages

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Trash2,
  ArrowLeft,
  Heart,
  Search,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface KudosItem {
  id: string;
  content: string;
  authorId: string;
  recipientId: string;
  author?: { id: string; displayName: string; avatarUrl?: string | null; photoUrl?: string };
  recipient?: { id: string; displayName: string; avatarUrl?: string | null; photoUrl?: string };
  likes: number;
  createdAt: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function AdminKudosPage() {
  const { playClick, playNotify } = useSounds();
  const [kudos, setKudos] = useState<KudosItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<KudosItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchKudos = useCallback(async () => {
    try {
      const res = await fetch("/api/kudos");
      const data = await res.json();
      setKudos(data.kudos || []);
    } catch {
      setKudos([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKudos();
  }, [fetchKudos]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/kudos?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Delete failed:", err);
      }
      playNotify();
      setDeleteTarget(null);
      await fetchKudos();
    } catch (e) {
      console.error("Delete error:", e);
    } finally {
      setIsDeleting(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  }

  const filtered = searchQuery.trim()
    ? kudos.filter(
        (k) =>
          k.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          k.author?.displayName
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          k.recipient?.displayName
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase())
      )
    : kudos;

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
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Props Moderation</h1>
            <p className="text-xs text-brand-grey">
              {kudos.length} total props messages
            </p>
          </div>
        </div>
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-brand-grey" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search props..."
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-brand-grey">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">
              {searchQuery ? "No matching props" : "No props yet"}
            </p>
            <p className="text-sm mt-1">
              {searchQuery
                ? "Try a different search term."
                : "Props will appear here when team members send them."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="w-[40%]">Message</TableHead>
                <TableHead>Likes</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {filtered.map((k, i) => (
                  <motion.tr
                    key={k.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage
                            src={k.author?.photoUrl || `/api/directory/photo?userId=${encodeURIComponent(k.author?.id || "")}&name=${encodeURIComponent(k.author?.displayName || "?")}&size=48x48`}
                            alt={k.author?.displayName || "?"}
                          />
                          <AvatarFallback className="text-[10px] bg-brand-blue/10 text-brand-blue">
                            {getInitials(k.author?.displayName || "?")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-gray-800 truncate max-w-[120px]">
                          {k.author?.displayName || "Unknown"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage
                            src={k.recipient?.photoUrl || `/api/directory/photo?userId=${encodeURIComponent(k.recipient?.id || "")}&name=${encodeURIComponent(k.recipient?.displayName || "?")}&size=48x48`}
                            alt={k.recipient?.displayName || "?"}
                          />
                          <AvatarFallback className="text-[10px] bg-green-100 text-green-700">
                            {getInitials(k.recipient?.displayName || "?")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-gray-800 truncate max-w-[120px]">
                          {k.recipient?.displayName || "Unknown"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-gray-700 truncate max-w-[320px]">
                        {k.content}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Heart className="w-3 h-3 text-pink-500" />
                        {k.likes}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-xs text-brand-grey block">
                          {timeAgo(k.createdAt)}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {formatDate(k.createdAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            playClick();
                            setDeleteTarget(k);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        )}
      </div>

      {/* Showing count */}
      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-brand-grey text-center">
          Showing {filtered.length} of {kudos.length} props messages
        </p>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Remove Props</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm text-brand-grey">
              This will permanently remove this props message from the feed:
            </p>
            {deleteTarget && (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-brand-grey mb-1">
                  <strong>{deleteTarget.author?.displayName}</strong> &rarr;{" "}
                  <strong>{deleteTarget.recipient?.displayName}</strong>
                </p>
                <p className="text-sm text-gray-700 italic">
                  &ldquo;{deleteTarget.content}&rdquo;
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
