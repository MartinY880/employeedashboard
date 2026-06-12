// ProConnect — Full Company Directory Page
// Searchable org chart with grid/list views and profile card dialog

"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Users,
  LayoutGrid,
  List,
  ChevronRight,
  X,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDirectory, type DirectoryNode, type DirectoryBranch } from "@/hooks/useDirectory";
import { useSounds } from "@/components/shared/SoundProvider";
import { DirectoryOrgChart } from "@/components/widgets/DirectoryOrgChart";
import { NMLSIcon } from "@/components/shared/icons/NMLSIcon"; 
import { ProfileDialog, getDeptColor, getDisplayTitle, getPhotoUrl, getInitials } from "@/components/shared/ProfileDialog";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function flattenTree(nodes: DirectoryNode[]): DirectoryNode[] {
  const flat: DirectoryNode[] = [];
  for (const node of nodes) {
    flat.push(node);
    if (node.directReports?.length) {
      flat.push(...flattenTree(node.directReports));
    }
  }
  return flat;
}

const MIN_SEARCH_LENGTH = 2;

function sortUsersByDisplayName(users: DirectoryNode[]): DirectoryNode[] {
  return [...users].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
  );
}

function getSearchRank(user: DirectoryNode, query: string): number {
  const q = query.toLowerCase();
  const fields: Array<[string | null | undefined, number]> = [
    [user.displayName, 0],
    [user.mail, 1],
    [user.jobTitle, 2],
    [user.department, 3],
  ];

  let best = Number.MAX_SAFE_INTEGER;
  for (const [value, weight] of fields) {
    if (!value) continue;
    const lower = value.toLowerCase();
    if (lower === q) return weight * 100;
    const idx = lower.indexOf(q);
    if (idx !== -1) {
      const score = weight * 100 + idx;
      if (score < best) best = score;
    }
  }
  return best;
}

function sortBySearchRank(users: DirectoryNode[], query: string): DirectoryNode[] {
  return [...users].sort((a, b) => {
    const aRank = getSearchRank(a, query);
    const bRank = getSearchRank(b, query);
    if (aRank !== bRank) return aRank - bRank;
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
  });
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-brand-blue">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

/**
 * Collect the full set of user IDs that belong to a branch — the assigned
 * members plus every descendant in the tree.
 */
function collectBranchIds(roots: DirectoryNode[], memberIds: Set<string>): Set<string> {
  const result = new Set<string>();

  function walk(node: DirectoryNode, inBranch: boolean) {
    const isMember = memberIds.has(node.id);
    const include = inBranch || isMember;
    if (include) result.add(node.id);
    for (const child of node.directReports ?? []) {
      walk(child, include);
    }
  }

  for (const root of roots) {
    walk(root, false);
  }
  return result;
}

function filterTreeByBranch(roots: DirectoryNode[], memberIds: Set<string>): DirectoryNode[] {
  const keepIds = collectBranchIds(roots, memberIds);

  function pruneTree(node: DirectoryNode): DirectoryNode | null {
    if (!keepIds.has(node.id)) {
      const prunedChildren: DirectoryNode[] = [];
      for (const child of node.directReports ?? []) {
        const pruned = pruneTree(child);
        if (pruned) prunedChildren.push(pruned);
      }
      return prunedChildren.length > 0 ? { ...node, directReports: prunedChildren } : null;
    }
    return {
      ...node,
      directReports: (node.directReports ?? [])
        .map(pruneTree)
        .filter((c): c is DirectoryNode => c !== null),
    };
  }

  return roots.map(pruneTree).filter((n): n is DirectoryNode => n !== null);
}

function normalizeEmployeeType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

// Sentinel branch id for the virtual "Shared" chip — selects everyone whose
// employeeType is in the admin-configured shared set, instead of a real branch.
const SHARED_BRANCH_ID = "__shared__";

/**
 * Filter the tree to the "Shared" group: keep every node whose employeeType is
 * in the shared set, their full subtree, and the ancestor chain up to the root.
 */
function filterTreeBySharedTypes(roots: DirectoryNode[], sharedTypes: Set<string>): DirectoryNode[] {
  const keepIds = new Set<string>();

  function collectSubtree(node: DirectoryNode) {
    keepIds.add(node.id);
    for (const child of node.directReports ?? []) collectSubtree(child);
  }

  function findMatches(node: DirectoryNode) {
    if (sharedTypes.has(normalizeEmployeeType(node.employeeType))) {
      collectSubtree(node);
    } else {
      for (const child of node.directReports ?? []) findMatches(child);
    }
  }

  for (const root of roots) findMatches(root);

  function pruneTree(node: DirectoryNode): DirectoryNode | null {
    if (keepIds.has(node.id)) {
      return {
        ...node,
        directReports: (node.directReports ?? []).filter((c) => keepIds.has(c.id)),
      };
    }
    const prunedChildren: DirectoryNode[] = [];
    for (const child of node.directReports ?? []) {
      const pruned = pruneTree(child);
      if (pruned) prunedChildren.push(pruned);
    }
    return prunedChildren.length > 0 ? { ...node, directReports: prunedChildren } : null;
  }

  return roots.map(pruneTree).filter((n): n is DirectoryNode => n !== null);
}

function filterTreeBySearch(roots: DirectoryNode[], query: string): DirectoryNode[] {
  const q = query.toLowerCase();
  const keepIds = new Set<string>();

  // Org chart search matches by name only (the grid/list still match all fields).
  const matches = (node: DirectoryNode) =>
    node.displayName.toLowerCase().includes(q);

  // Keep the matched node, its ancestors (path from root down to the match),
  // and its ENTIRE subtree. Visibility below the match is controlled by the
  // chart's collapse state (see DirectoryOrgChart matchedNodeIds), not by
  // removing nodes here — so a user can drill into a report's team.
  function collectSubtree(node: DirectoryNode) {
    keepIds.add(node.id);
    for (const child of node.directReports ?? []) collectSubtree(child);
  }

  function findMatches(node: DirectoryNode, path: DirectoryNode[]) {
    const pathWithNode = [...path, node];
    if (matches(node)) {
      for (const ancestor of pathWithNode) keepIds.add(ancestor.id);
      collectSubtree(node);
    } else {
      for (const child of node.directReports ?? []) findMatches(child, pathWithNode);
    }
  }

  for (const root of roots) findMatches(root, []);

  function pruneTree(node: DirectoryNode): DirectoryNode | null {
    if (keepIds.has(node.id)) {
      return {
        ...node,
        directReports: (node.directReports ?? []).filter((c) => keepIds.has(c.id)),
      };
    }
    const prunedChildren: DirectoryNode[] = [];
    for (const child of node.directReports ?? []) {
      const pruned = pruneTree(child);
      if (pruned) prunedChildren.push(pruned);
    }
    return prunedChildren.length > 0 ? { ...node, directReports: prunedChildren } : null;
  }

  return roots.map(pruneTree).filter((n): n is DirectoryNode => n !== null);
}

/* ------------------------------------------------------------------ */
/* Main Page Component                                                 */
/* ------------------------------------------------------------------ */

export default function DirectoryPage() {
  const { playClick } = useSounds();
  const { users: treeUsers, branches, config, isLoading, refetch } = useDirectory("tree");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "tree">("tree");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<DirectoryNode | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncAvailable, setSyncAvailable] = useState(true);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [chartResetKey, setChartResetKey] = useState(0);

  useEffect(() => {
    let active = true;
    const loadSyncStatus = async () => {
      try {
        const res = await fetch("/api/directory/sync", { cache: "no-store" });
        if (!active) return;
        if (res.status === 403 || res.status === 401) { setSyncAvailable(false); return; }
        if (!res.ok) { setSyncStatus("Sync status unavailable"); return; }
        const data = await res.json();
        if (data?.lastSyncedAt) setSyncStatus(`Last sync: ${new Date(data.lastSyncedAt).toLocaleString()}`);
      } catch {
        if (active) setSyncStatus("Sync status unavailable");
      }
    };
    void loadSyncStatus();
    return () => { active = false; };
  }, []);

  const flatUsers = useMemo(() => flattenTree(treeUsers), [treeUsers]);
  const sortedFlatUsers = useMemo(() => sortUsersByDisplayName(flatUsers), [flatUsers]);

  const trimmedSearchQuery = searchQuery.trim();
  const isSearchLongEnough = trimmedSearchQuery.length >= MIN_SEARCH_LENGTH;
  const activeSearchQuery = isSearchLongEnough ? trimmedSearchQuery : "";
  const isSearchTooShort = trimmedSearchQuery.length > 0 && !isSearchLongEnough;

  // Employee types classified as "Shared" (from admin config), normalized.
  // Shared users form the virtual "Shared" branch and are excluded from real
  // branch grouping — they don't sit under any one branch.
  const sharedTypeSet = useMemo<Set<string>>(
    () => new Set((config?.sharedEmployeeTypes ?? []).map(normalizeEmployeeType)),
    [config?.sharedEmployeeTypes]
  );

  // Azure IDs of all Shared users (used to strip them from real branches).
  const sharedUserIds = useMemo<Set<string>>(
    () =>
      new Set(
        sharedTypeSet.size === 0
          ? []
          : flatUsers
              .filter((u) => sharedTypeSet.has(normalizeEmployeeType(u.employeeType)))
              .map((u) => u.id)
      ),
    [flatUsers, sharedTypeSet]
  );

  // Show the "Shared" chip only when shared types are configured and at least
  // one matching user exists.
  const hasSharedUsers = sharedUserIds.size > 0;
  const isSharedSelected = selectedBranchId === SHARED_BRANCH_ID;

  const selectedBranch = useMemo<DirectoryBranch | null>(
    () => branches.find((b) => b.id === selectedBranchId) ?? null,
    [branches, selectedBranchId]
  );

  // Real-branch members, with Shared users removed so they never group under a
  // real branch.
  const selectedBranchMemberIds = useMemo<Set<string>>(
    () => new Set((selectedBranch?.memberIds ?? []).filter((id) => !sharedUserIds.has(id))),
    [selectedBranch, sharedUserIds]
  );

  // Member IDs across all branches — these are the managing partners, used to
  // give them a "Managing Partner" title when their Entra title is blank.
  const allBranchMemberIds = useMemo<Set<string>>(
    () => new Set(branches.flatMap((b) => b.memberIds)),
    [branches]
  );

  // Filtered tree for org chart view
  const filteredTreeUsers = useMemo(() => {
    let result = treeUsers;
    if (isSharedSelected) result = filterTreeBySharedTypes(result, sharedTypeSet);
    else if (selectedBranch) result = filterTreeByBranch(result, selectedBranchMemberIds);
    if (activeSearchQuery) result = filterTreeBySearch(result, activeSearchQuery);
    return result;
  }, [treeUsers, isSharedSelected, sharedTypeSet, selectedBranch, selectedBranchMemberIds, activeSearchQuery]);

  // IDs of users that directly match the search query (not their ancestors or
  // descendants). The org chart uses these to expand the path to each match
  // and center the viewport on it, leaving reports collapsed.
  const matchedIds = useMemo<string[]>(() => {
    if (!activeSearchQuery) return [];
    const q = activeSearchQuery.toLowerCase();
    // Name-only, matching filterTreeBySearch (org chart). Grid/list match all fields.
    return flatUsers
      .filter((u) => u.displayName.toLowerCase().includes(q))
      .filter((u) => !isSharedSelected || sharedTypeSet.has(normalizeEmployeeType(u.employeeType)))
      .map((u) => u.id);
  }, [flatUsers, activeSearchQuery, isSharedSelected, sharedTypeSet]);

  // Filtered flat list for grid/list view
  const filteredUsers = useMemo(() => {
    let result = sortedFlatUsers;

    if (isSharedSelected) {
      result = result.filter((u) => sharedTypeSet.has(normalizeEmployeeType(u.employeeType)));
    } else if (selectedBranch) {
      const branchIds = collectBranchIds(treeUsers, selectedBranchMemberIds);
      result = result.filter((u) => branchIds.has(u.id));
    }

    if (activeSearchQuery) {
      const q = activeSearchQuery.toLowerCase();
      const filtered = result.filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          (u.mail && u.mail.toLowerCase().includes(q)) ||
          (u.jobTitle && u.jobTitle.toLowerCase().includes(q)) ||
          (u.department && u.department.toLowerCase().includes(q))
      );
      return sortBySearchRank(filtered, activeSearchQuery);
    }

    return result;
  }, [sortedFlatUsers, isSharedSelected, sharedTypeSet, selectedBranch, selectedBranchMemberIds, treeUsers, activeSearchQuery]);

  function handleSelectUser(user: DirectoryNode) {
    playClick();
    setSelectedUser(user);
    setProfileOpen(true);
  }

  async function handleSyncNow() {
    setSyncBusy(true);
    setSyncStatus("Syncing directory…");
    try {
      const res = await fetch("/api/directory/sync", { method: "POST" });
      if (res.status === 403 || res.status === 401) { setSyncAvailable(false); setSyncStatus("No permission to sync"); return; }
      if (!res.ok) { setSyncStatus("Directory sync failed"); return; }
      const data = await res.json();
      const ts = data?.lastSyncedAt ? new Date(data.lastSyncedAt).toLocaleString() : "just now";
      setSyncStatus(`Synced ${data?.count ?? ""} users at ${ts}`.trim());
      await refetch();
    } catch {
      setSyncStatus("Directory sync failed");
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <div className="max-w-[1920px] mx-auto px-5 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Company Directory</h1>
          <p className="text-sm text-brand-grey mt-1">{flatUsers.length} total employees</p>
        </div>
        <div className="flex items-center gap-2">
          {syncAvailable && (
            <button
              onClick={handleSyncNow}
              disabled={syncBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncBusy ? "animate-spin" : ""}`} />
              {syncBusy ? "Syncing" : "Sync Directory"}
            </button>
          )}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {[
              { id: "tree" as const, icon: Users, label: "Org Chart" },
              { id: "grid" as const, icon: LayoutGrid, label: "Grid" },
              { id: "list" as const, icon: List, label: "List" },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => { playClick(); setViewMode(v.id); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === v.id
                    ? "bg-white dark:bg-gray-900 text-brand-blue shadow-sm"
                    : "text-brand-grey hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <v.icon className="w-3.5 h-3.5" />
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {syncStatus && <p className="text-xs text-brand-grey mb-4">{syncStatus}</p>}

      {/* Search & Branch Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-grey" />
            <Input
              placeholder="Search by name, email, title, or department…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white dark:bg-gray-900"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-brand-grey hover:text-gray-700" />
              </button>
            )}
          </div>
          {isSearchTooShort && (
            <p className="mt-1 text-xs text-brand-grey">Enter at least {MIN_SEARCH_LENGTH} characters to search.</p>
          )}
        </div>

        {/* Branch filter chips — branches plus a virtual "Shared" group */}
        {(branches.length > 0 || hasSharedUsers) && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => { playClick(); setSelectedBranchId(null); }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                !selectedBranchId
                  ? "bg-brand-blue text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-brand-grey hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {branches.map((branch) => (
              <button
                key={branch.id}
                onClick={() => { playClick(); setSelectedBranchId(selectedBranchId === branch.id ? null : branch.id); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedBranchId === branch.id
                    ? "bg-brand-blue text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-brand-grey hover:bg-gray-200"
                }`}
              >
                {branch.name}
              </button>
            ))}
            {hasSharedUsers && (
              <button
                onClick={() => { playClick(); setSelectedBranchId(isSharedSelected ? null : SHARED_BRANCH_ID); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isSharedSelected
                    ? "bg-brand-blue text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-brand-grey hover:bg-gray-200"
                }`}
              >
                Shared
              </button>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <Skeleton className="h-16 w-16 rounded-full mb-3" />
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {!isLoading && filteredUsers.length === 0 && viewMode !== "tree" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <Users className="w-12 h-12 text-brand-grey/30 mx-auto mb-3" />
          <p className="text-brand-grey text-sm">No team members found</p>
          <p className="text-xs text-brand-grey/60 mt-1">Try a different search or filter</p>
        </motion.div>
      )}

      {/* Grid View */}
      {!isLoading && viewMode === "grid" && filteredUsers.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {filteredUsers.map((user, i) => (
            <motion.button
              key={user.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              onClick={() => handleSelectUser(user)}
              className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-lg hover:border-brand-blue/20 transition-all text-center group hover:-translate-y-1 hover:scale-[1.02]"
            >
              <div className="relative h-16 w-16 mx-auto mb-3 rounded-full overflow-hidden bg-brand-blue flex items-center justify-center shrink-0">
                <span className="text-white text-lg font-bold select-none" aria-hidden>
                  {getInitials(user.displayName)}
                </span>
                <img
                  src={getPhotoUrl(user, 120)}
                  alt={user.displayName}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 group-hover:text-brand-blue transition-colors truncate">
                {activeSearchQuery ? highlightMatch(user.displayName, activeSearchQuery) : user.displayName}
              </h3>
              <p className="text-xs text-brand-grey mt-0.5 truncate">{getDisplayTitle(user.jobTitle, allBranchMemberIds.has(user.id))}</p>
              {user.department && (
                <Badge className={`mt-2 text-[10px] ${getDeptColor(user.department)}`} variant="secondary">
                  {user.department}
                </Badge>
              )}
              {user.officeLocation && (
                <p className="text-[11px] text-brand-grey/60 mt-1.5 flex items-center justify-center gap-1">
                  <NMLSIcon className="w-3 h-3" />
                  {user.officeLocation}
                </p>
              )}
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* List View */}
      {!isLoading && viewMode === "list" && filteredUsers.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[64px_minmax(180px,2fr)_minmax(140px,1.2fr)_minmax(140px,1.2fr)_minmax(120px,1fr)] gap-6 px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-brand-grey uppercase tracking-wider">
            <span className="w-9" />
            <span>Name</span>
            <span>Title</span>
            <span>Department</span>
            <span>NMLS</span>
          </div>
          {filteredUsers.map((user, i) => (
            <motion.button
              key={user.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.02 }}
              onClick={() => handleSelectUser(user)}
              className="w-full grid grid-cols-[64px_minmax(180px,2fr)_minmax(140px,1.2fr)_minmax(140px,1.2fr)_minmax(120px,1fr)] gap-6 px-6 py-3 border-b border-gray-50 hover:bg-blue-50/40 transition-colors items-center text-left group"
            >
              <div className="relative h-9 w-9 rounded-full overflow-hidden bg-brand-blue/10 flex items-center justify-center shrink-0">
                <span className="text-brand-blue text-xs font-semibold select-none" aria-hidden>
                  {getInitials(user.displayName)}
                </span>
                <img
                  src={getPhotoUrl(user, 48)}
                  alt={user.displayName}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-brand-blue transition-colors truncate block">
                  {activeSearchQuery ? highlightMatch(user.displayName, activeSearchQuery) : user.displayName}
                </span>
                {user.mail && <span className="text-[11px] text-brand-grey truncate block">{user.mail}</span>}
              </div>
              <div className="justify-self-start min-w-0">
                <span className="block text-sm text-gray-600 dark:text-gray-400 truncate">{user.jobTitle || <span className="text-gray-300 dark:text-gray-600">—</span>}</span>
              </div>
              <div className="justify-self-start">
                {user.department ? (
                  <Badge className={`text-[10px] ${getDeptColor(user.department)}`} variant="secondary">
                    {user.department}
                  </Badge>
                ) : (
                  <span className="text-sm text-gray-300 dark:text-gray-600">—</span>
                )}
              </div>
              <span className="text-xs text-brand-grey truncate max-w-[140px]">{user.officeLocation || <span className="text-gray-300 dark:text-gray-600">—</span>}</span>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Tree / Org Chart View */}
      {!isLoading && viewMode === "tree" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
          {filteredTreeUsers.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-brand-grey/30 mx-auto mb-3" />
              <p className="text-brand-grey text-sm">No matching directory data</p>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-3">
                <button
                  onClick={() => { playClick(); setChartResetKey((k) => k + 1); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Reset Zoom
                </button>
              </div>
              <DirectoryOrgChart
                key={`${chartResetKey}-${selectedBranchId ?? "all"}-${activeSearchQuery}`}
                users={filteredTreeUsers}
                branches={branches}
                onSelect={handleSelectUser}
                matchedNodeIds={matchedIds}
                expandAll={false}
              />
            </>
          )}
        </motion.div>
      )}

      {/* Profile Dialog */}
      <ProfileDialog user={selectedUser} open={profileOpen} onClose={() => setProfileOpen(false)} branchMemberIds={allBranchMemberIds} />
    </div>
  );
}
