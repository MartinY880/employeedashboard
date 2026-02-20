// ProConnect — DirectoryTree Widget
// Hierarchical org tree from /api/directory (Graph API or demo fallback)

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Users, Search, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { useDirectory, type DirectoryNode } from "@/hooks/useDirectory";
import { useSounds } from "@/components/shared/SoundProvider";
import Link from "next/link";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Current user email — matched from auth context
const CURRENT_USER_EMAIL = "john.doe@mortgagepros.com";

function TreeItem({
  node,
  depth = 0,
}: {
  node: DirectoryNode;
  depth?: number;
}) {
  const { playClick } = useSounds();
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = (node.directReports?.length ?? 0) > 0;
  const isCurrentUser =
    node.mail === CURRENT_USER_EMAIL ||
    node.userPrincipalName === CURRENT_USER_EMAIL;

  return (
    <div>
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, delay: depth * 0.03 }}
        onClick={() => { if (hasChildren) { setExpanded(!expanded); playClick(); } }}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors text-sm group ${
          isCurrentUser
            ? "bg-blue-50 border-l-[3px] border-l-brand-blue"
            : "hover:bg-gray-50"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {hasChildren ? (
          <motion.div
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0"
          >
            <ChevronRight className="w-3.5 h-3.5 text-brand-grey" />
          </motion.div>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage
            src={node.photoUrl || `/api/directory/photo?userId=${encodeURIComponent(node.id)}&name=${encodeURIComponent(node.displayName)}&size=48x48`}
            alt={node.displayName}
          />
          <AvatarFallback className="bg-brand-blue/10 text-brand-blue text-[10px] font-semibold">
            {getInitials(node.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div
            className={`font-medium truncate text-[13px] ${
              isCurrentUser ? "text-brand-blue" : "text-gray-800"
            }`}
          >
            {node.displayName}
            {isCurrentUser && (
              <span className="text-[10px] ml-1.5 text-brand-blue/60 font-normal">
                (you)
              </span>
            )}
          </div>
          <div className="text-[11px] text-brand-grey truncate">
            {node.jobTitle || "Team Member"}
          </div>
        </div>
        {hasChildren && (
          <span className="text-[10px] text-brand-grey/60 tabular-nums shrink-0">
            {node.directReports!.length}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {hasChildren && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {node.directReports!.map((child) => (
              <TreeItem key={child.id} node={child} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TreeSkeleton() {
  return (
    <div className="py-2 px-3 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5"
          style={{ paddingLeft: `${i < 1 ? 0 : i < 3 ? 16 : 32}px` }}
        >
          <Skeleton className="h-7 w-7 rounded-full shrink-0" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Flatten tree for search ── */
function flattenTree(nodes: DirectoryNode[]): DirectoryNode[] {
  const flat: DirectoryNode[] = [];
  for (const n of nodes) {
    flat.push(n);
    if (n.directReports?.length) flat.push(...flattenTree(n.directReports));
  }
  return flat;
}

export function DirectoryTree() {
  const { users, isLoading, error } = useDirectory("tree");
  const [searchQuery, setSearchQuery] = useState("");
  const { playClick } = useSounds();

  const flatUsers = useMemo(() => flattenTree(users), [users]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return flatUsers.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        (u.jobTitle && u.jobTitle.toLowerCase().includes(q)) ||
        (u.mail && u.mail.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [flatUsers, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  if (isLoading) {
    return <TreeSkeleton />;
  }

  if (error || users.length === 0) {
    return (
      <div className="py-8 px-4 text-center">
        <Users className="w-8 h-8 text-brand-grey/40 mx-auto mb-2" />
        <p className="text-sm text-brand-grey">No directory data available</p>
        <p className="text-xs text-brand-grey/60 mt-1">
          Connect Microsoft Graph API to see your org chart
        </p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {/* Search input */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-grey/60" />
          <input
            type="text"
            placeholder="Find someone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-blue/40 focus:border-brand-blue/40 placeholder:text-brand-grey/50 transition-colors"
          />
          {isSearching && (
            <button
              onClick={() => { setSearchQuery(""); playClick(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3 h-3 text-brand-grey hover:text-gray-700" />
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      {isSearching ? (
        <div>
          {searchResults.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-brand-grey">No results for &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : (
            <AnimatePresence>
              {searchResults.map((node, i) => (
                <motion.div
                  key={node.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: i * 0.03 }}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 rounded-lg mx-1 transition-colors cursor-default"
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage
                      src={node.photoUrl || `/api/directory/photo?userId=${encodeURIComponent(node.id)}&name=${encodeURIComponent(node.displayName)}&size=48x48`}
                      alt={node.displayName}
                    />
                    <AvatarFallback className="bg-brand-blue/10 text-brand-blue text-[10px] font-semibold">
                      {getInitials(node.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate text-[13px] text-gray-800">
                      {node.displayName}
                    </div>
                    <div className="text-[11px] text-brand-grey truncate">
                      {node.jobTitle || "Team Member"}
                      {node.department ? ` · ${node.department}` : ""}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          <div className="px-4 pt-2 pb-1 border-t border-gray-100 mt-1">
            <Link
              href={`/directory?q=${encodeURIComponent(searchQuery)}`}
              className="text-xs text-brand-blue hover:underline font-medium"
            >
              Search full directory →
            </Link>
          </div>
        </div>
      ) : (
        /* Normal tree view */
        <>
          {users.map((node) => (
            <TreeItem key={node.id} node={node} />
          ))}
          <div className="px-4 pt-3 pb-1">
            <Link
              href="/directory"
              className="text-xs text-brand-blue hover:underline font-medium"
            >
              View full directory →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
