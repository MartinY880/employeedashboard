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
  Mail,
  MapPin,
  Building2,
  Briefcase,
  ChevronRight,
  X,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDirectory, type DirectoryNode } from "@/hooks/useDirectory";
import { useSounds } from "@/components/shared/SoundProvider";
import { DirectoryOrgChart } from "@/components/widgets/DirectoryOrgChart";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getPhotoUrl(user: { id: string; displayName: string; photoUrl?: string }, size = 120) {
  return user.photoUrl || `/api/directory/photo?userId=${encodeURIComponent(user.id)}&name=${encodeURIComponent(user.displayName)}&size=${size}x${size}`;
}

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

function normalizeEmployeeType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Filter the tree for a given Employee Type.
 *
 * 1. Find every node whose employeeType matches the filter.
 * 2. Include the full subtree under each matched node.
 * 3. Include the ancestor chain from each matched node up to the root.
 * 4. Prune branches that don't lead to a matched node or its descendants.
 */
function filterTreeByEmployeeType(
  roots: DirectoryNode[],
  employeeType: string
): DirectoryNode[] {
  const selectedType = normalizeEmployeeType(employeeType);
  // Collect IDs of matched nodes + all their descendants
  const keepIds = new Set<string>();

  function collectSubtree(node: DirectoryNode) {
    keepIds.add(node.id);
    for (const child of node.directReports ?? []) {
      collectSubtree(child);
    }
  }

  // Walk the whole tree to find nodes with matching employeeType
  function findMatches(node: DirectoryNode) {
    if (normalizeEmployeeType(node.employeeType) === selectedType) {
      collectSubtree(node);
    } else {
      // Keep looking in children even if this node doesn't match
      for (const child of node.directReports ?? []) {
        findMatches(child);
      }
    }
  }

  for (const root of roots) {
    findMatches(root);
  }

  // Now mark ancestor chains: walk down from each root, keeping nodes
  // that are ancestors of any keepId node.
  function pruneTree(node: DirectoryNode): DirectoryNode | null {
    // If this node or any descendant is in keepIds, include it
    if (keepIds.has(node.id)) {
      // This node is in the matched subtree — include it with full descendants
      // that are also in keepIds
      return {
        ...node,
        directReports: (node.directReports ?? []).filter((c) => keepIds.has(c.id)),
      };
    }

    // Check if any children lead to a kept node
    const prunedChildren: DirectoryNode[] = [];
    for (const child of node.directReports ?? []) {
      const pruned = pruneTree(child);
      if (pruned) prunedChildren.push(pruned);
    }

    if (prunedChildren.length > 0) {
      // This node is an ancestor — include it but only with relevant children
      return { ...node, directReports: prunedChildren };
    }

    return null; // Not relevant
  }

  const filtered: DirectoryNode[] = [];
  for (const root of roots) {
    const pruned = pruneTree(root);
    if (pruned) filtered.push(pruned);
  }
  return filtered;
}

function filterTreeBySearch(
  roots: DirectoryNode[],
  query: string
): DirectoryNode[] {
  const q = query.toLowerCase();
  const keepIds = new Set<string>();

  const matches = (node: DirectoryNode) =>
    node.displayName.toLowerCase().includes(q) ||
    (node.mail && node.mail.toLowerCase().includes(q)) ||
    (node.jobTitle && node.jobTitle.toLowerCase().includes(q)) ||
    (node.department && node.department.toLowerCase().includes(q)) ||
    ((node.employeeType ?? "").toLowerCase().includes(q));

  function collectSubtree(node: DirectoryNode) {
    keepIds.add(node.id);
    for (const child of node.directReports ?? []) {
      collectSubtree(child);
    }
  }

  function findMatches(node: DirectoryNode) {
    if (matches(node)) {
      collectSubtree(node);
    } else {
      for (const child of node.directReports ?? []) {
        findMatches(child);
      }
    }
  }

  for (const root of roots) {
    findMatches(root);
  }

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

    if (prunedChildren.length > 0) {
      return { ...node, directReports: prunedChildren };
    }

    return null;
  }

  const filtered: DirectoryNode[] = [];
  for (const root of roots) {
    const pruned = pruneTree(root);
    if (pruned) filtered.push(pruned);
  }
  return filtered;
}

/* ------------------------------------------------------------------ */
/* Department Colors                                                   */
/* ------------------------------------------------------------------ */

const DEPT_COLORS: Record<string, string> = {
  Executive: "bg-purple-100 text-purple-700",
  Operations: "bg-blue-100 text-blue-700",
  Sales: "bg-green-100 text-green-700",
  Lending: "bg-amber-100 text-amber-700",
  Processing: "bg-sky-100 text-sky-700",
  Underwriting: "bg-indigo-100 text-indigo-700",
  Compliance: "bg-red-100 text-red-700",
};

function getDeptColor(dept: string | null) {
  if (!dept) return "bg-gray-100 text-gray-600";
  return DEPT_COLORS[dept] || "bg-gray-100 text-gray-600";
}

/* ------------------------------------------------------------------ */
/* Profile Card Dialog                                                 */
/* ------------------------------------------------------------------ */

function ProfileDialog({
  user,
  open,
  onClose,
}: {
  user: DirectoryNode | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Employee Profile</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center text-center pt-2 pb-4">
          <Avatar className="h-20 w-20 mb-4">
            <AvatarImage
              src={getPhotoUrl(user, 240)}
              alt={user.displayName}
              loading="lazy"
              decoding="async"
            />
            <AvatarFallback className="bg-brand-blue text-white text-xl font-bold">
              {getInitials(user.displayName)}
            </AvatarFallback>
          </Avatar>
          <h3 className="text-lg font-semibold text-gray-900">
            {user.displayName}
          </h3>
          {user.jobTitle && (
            <p className="text-sm text-brand-grey mt-0.5">{user.jobTitle}</p>
          )}
          {user.department && (
            <Badge
              className={`mt-2 text-xs font-medium ${getDeptColor(user.department)}`}
              variant="secondary"
            >
              {user.department}
            </Badge>
          )}
        </div>

        <div className="space-y-3 border-t border-gray-100 pt-4">
          {user.mail && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-brand-grey shrink-0" />
              <a
                href={`mailto:${user.mail}`}
                className="text-brand-blue hover:underline truncate"
              >
                {user.mail}
              </a>
            </div>
          )}
          {user.department && (
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="w-4 h-4 text-brand-grey shrink-0" />
              <span className="text-gray-700">{user.department}</span>
            </div>
          )}
          {user.jobTitle && (
            <div className="flex items-center gap-3 text-sm">
              <Briefcase className="w-4 h-4 text-brand-grey shrink-0" />
              <span className="text-gray-700">{user.jobTitle}</span>
            </div>
          )}
          {user.officeLocation && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-brand-grey shrink-0" />
              <span className="text-gray-700">{user.officeLocation}</span>
            </div>
          )}
        </div>

        {user.directReports && user.directReports.length > 0 && (
          <div className="border-t border-gray-100 pt-4 mt-2">
            <p className="text-xs font-semibold text-brand-grey uppercase tracking-wider mb-2">
              Direct Reports ({user.directReports.length})
            </p>
            <div className="space-y-1.5">
              {user.directReports.map((dr) => (
                <div
                  key={dr.id}
                  className="flex items-center gap-2 text-sm py-1"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-brand-blue/10 text-brand-blue text-[9px] font-semibold">
                      {getInitials(dr.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-gray-700 truncate">
                    {dr.displayName}
                  </span>
                  <span className="text-xs text-brand-grey ml-auto shrink-0">
                    {dr.jobTitle || "Team Member"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Vertical Org Chart (top-down hierarchy)                             */
/* ------------------------------------------------------------------ */

function OrgChartNode({
  node,
  onSelect,
  depth = 0,
}: {
  node: DirectoryNode;
  onSelect: (user: DirectoryNode) => void;
  depth?: number;
}) {
  const [collapsed, setCollapsed] = useState(depth >= 3);
  const directReports = node.directReports ?? [];
  const hasChildren = directReports.length > 0;
  const reportCount = directReports.length;
  const useWrappedRows = reportCount > 3;
  const useEmployeeTypeGroups = directReports.some(
    (report) => (report.employeeType ?? "").trim().length > 0
  );
  const groupedDirectReports = useMemo(() => {
    const groups = new Map<string, DirectoryNode[]>();

    for (const report of directReports) {
      const key = (report.employeeType ?? "").trim() || "Other";
      const existing = groups.get(key);
      if (existing) {
        existing.push(report);
      } else {
        groups.set(key, [report]);
      }
    }

    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
  }, [directReports]);

  return (
    <div className="flex flex-col items-center">
      {/* ── Node card ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: depth * 0.04 }}
        className="flex flex-col items-center"
      >
        <button
          onClick={() => onSelect(node)}
          className="group flex flex-col items-center bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-blue/30 transition-all px-4 py-3 w-[160px] text-center"
        >
          <Avatar className="h-12 w-12 mb-1.5 ring-2 ring-white shadow-sm">
            <AvatarImage
              src={getPhotoUrl(node, 64)}
              alt={node.displayName}
              loading="lazy"
              decoding="async"
            />
            <AvatarFallback className="bg-brand-blue text-white text-sm font-bold">
              {getInitials(node.displayName)}
            </AvatarFallback>
          </Avatar>
          <span className="font-semibold text-xs text-gray-900 group-hover:text-brand-blue transition-colors truncate w-full">
            {node.displayName}
          </span>
          <span className="text-[10px] text-brand-grey truncate w-full mt-0.5">
            {node.jobTitle || "Team Member"}
          </span>
          {node.department && (
            <Badge
              className={`mt-1.5 text-[9px] px-1.5 py-0 h-4 ${getDeptColor(node.department)}`}
              variant="secondary"
            >
              {node.department}
            </Badge>
          )}
        </button>

        {/* Expand/collapse toggle */}
        {hasChildren && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="mt-1.5 flex items-center gap-0.5 text-[10px] text-brand-grey hover:text-brand-blue transition-colors"
          >
            <motion.div
              animate={{ rotate: collapsed ? 0 : 90 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronRight className="w-3 h-3" />
            </motion.div>
            {collapsed
              ? `${directReports.length} report${directReports.length > 1 ? "s" : ""}`
              : "collapse"}
          </button>
        )}
      </motion.div>

      {/* ── Vertical connector + children row ── */}
      <AnimatePresence>
        {hasChildren && !collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center overflow-hidden"
          >
            {/* Vertical line down from parent */}
            <div className="w-px h-6 bg-gray-300" />

            {/* Children layout */}
            {useEmployeeTypeGroups ? (
              <div className="flex flex-wrap justify-center gap-6 max-w-[1200px]">
                {groupedDirectReports.map(([groupName, reports]) => (
                  <div
                    key={`${node.id}-${groupName}`}
                    className="border border-gray-200 rounded-lg bg-gray-50/70 px-4 py-3"
                  >
                    <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide text-center mb-3">
                      {groupName}
                    </p>
                    <div className="grid grid-cols-3 gap-x-6 gap-y-8 items-start">
                      {reports.map((child) => (
                        <div
                          key={child.id}
                          className="flex flex-col items-center"
                          style={{ minWidth: 180 }}
                        >
                          <div className="w-px h-5 bg-gray-300" />
                          <OrgChartNode
                            node={child}
                            onSelect={onSelect}
                            depth={depth + 1}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={
                  useWrappedRows
                    ? "grid grid-cols-3 gap-x-6 gap-y-8 items-start"
                    : "flex items-start"
                }
              >
                {directReports.map((child, i) => (
                  <div
                    key={child.id}
                    className="flex flex-col items-center"
                    style={{ minWidth: 180 }}
                  >
                    {/* Horizontal rail segment (drawn as two halves so we can
                        hide the outer half on the first / last child) */}
                    {!useWrappedRows && directReports.length > 1 && (
                      <div className="flex w-full">
                        <div
                          className={`h-px flex-1 ${
                            i === 0 ? "bg-transparent" : "bg-gray-300"
                          }`}
                        />
                        <div
                          className={`h-px flex-1 ${
                            i === directReports.length - 1
                              ? "bg-transparent"
                              : "bg-gray-300"
                          }`}
                        />
                      </div>
                    )}
                    {/* Vertical tick down to child */}
                    <div className="w-px h-5 bg-gray-300" />
                    <OrgChartNode
                      node={child}
                      onSelect={onSelect}
                      depth={depth + 1}
                    />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Page Component                                                 */
/* ------------------------------------------------------------------ */

export default function DirectoryPage() {
  const { playClick } = useSounds();
  const { users: treeUsers, isLoading, refetch } = useDirectory("tree");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "tree">("tree");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployeeType, setSelectedEmployeeType] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<DirectoryNode | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncAvailable, setSyncAvailable] = useState(true);
  const [syncStatus, setSyncStatus] = useState<string>("");

  useEffect(() => {
    let active = true;
    const loadSyncStatus = async () => {
      try {
        const res = await fetch("/api/directory/sync", { cache: "no-store" });
        if (!active) return;
        if (res.status === 403 || res.status === 401) {
          setSyncAvailable(false);
          return;
        }

        if (!res.ok) {
          setSyncStatus("Sync status unavailable");
          return;
        }

        const data = await res.json();
        if (data?.lastSyncedAt) {
          const ts = new Date(data.lastSyncedAt).toLocaleString();
          setSyncStatus(`Last sync: ${ts}`);
        }
      } catch {
        if (active) setSyncStatus("Sync status unavailable");
      }
    };

    void loadSyncStatus();
    return () => {
      active = false;
    };
  }, []);

  // Flatten the tree for grid/list views and filtering
  const flatUsers = useMemo(() => flattenTree(treeUsers), [treeUsers]);

  const employeeTypeOptions = useMemo(
    () => ["North", "South", "East", "Operations", "IT"],
    []
  );

  const filteredTreeUsers = useMemo(() => {
    let result = treeUsers;

    if (selectedEmployeeType) {
      result = filterTreeByEmployeeType(result, selectedEmployeeType);
    }

    if (searchQuery.trim()) {
      result = filterTreeBySearch(result, searchQuery.trim());
    }

    return result;
  }, [treeUsers, selectedEmployeeType, searchQuery]);

  // Filter
  const filteredUsers = useMemo(() => {
    let result = flatUsers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          (u.mail && u.mail.toLowerCase().includes(q)) ||
          (u.jobTitle && u.jobTitle.toLowerCase().includes(q)) ||
          (u.department && u.department.toLowerCase().includes(q)) ||
          ((u.employeeType ?? "").toLowerCase().includes(q))
      );
    }
    if (selectedEmployeeType) {
      const selectedType = normalizeEmployeeType(selectedEmployeeType);
      result = result.filter(
        (u) => normalizeEmployeeType(u.employeeType) === selectedType
      );
    }
    return result;
  }, [flatUsers, searchQuery, selectedEmployeeType]);

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
      if (res.status === 403 || res.status === 401) {
        setSyncAvailable(false);
        setSyncStatus("No permission to sync");
        return;
      }
      if (!res.ok) {
        setSyncStatus("Directory sync failed");
        return;
      }

      const data = await res.json();
      const ts = data?.lastSyncedAt
        ? new Date(data.lastSyncedAt).toLocaleString()
        : "just now";
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
          <h1 className="text-2xl font-semibold text-gray-900">
            Company Directory
          </h1>
          <p className="text-sm text-brand-grey mt-1">
            {flatUsers.length} team members
          </p>
        </div>

        <div className="flex items-center gap-2">
          {syncAvailable && (
            <button
              onClick={handleSyncNow}
              disabled={syncBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncBusy ? "animate-spin" : ""}`} />
              {syncBusy ? "Syncing" : "Sync Directory"}
            </button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { id: "tree" as const, icon: Users, label: "Org Chart" },
              { id: "grid" as const, icon: LayoutGrid, label: "Grid" },
              { id: "list" as const, icon: List, label: "List" },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  playClick();
                  setViewMode(v.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === v.id
                    ? "bg-white text-brand-blue shadow-sm"
                    : "text-brand-grey hover:text-gray-700"
                }`}
              >
                <v.icon className="w-3.5 h-3.5" />
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {syncStatus && (
        <p className="text-xs text-brand-grey mb-4">{syncStatus}</p>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-grey" />
          <Input
            placeholder="Search by name, email, title, or department…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5 text-brand-grey hover:text-gray-700" />
            </button>
          )}
        </div>

        {/* Employee type filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => {
              playClick();
              setSelectedEmployeeType(null);
            }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              !selectedEmployeeType
                ? "bg-brand-blue text-white"
                : "bg-gray-100 text-brand-grey hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {employeeTypeOptions.map((employeeType) => (
            <button
              key={employeeType}
              onClick={() => {
                playClick();
                setSelectedEmployeeType(
                  selectedEmployeeType === employeeType ? null : employeeType
                );
              }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedEmployeeType === employeeType
                  ? "bg-brand-blue text-white"
                  : "bg-gray-100 text-brand-grey hover:bg-gray-200"
              }`}
            >
              {employeeType}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm"
            >
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Users className="w-12 h-12 text-brand-grey/30 mx-auto mb-3" />
          <p className="text-brand-grey text-sm">No team members found</p>
          <p className="text-xs text-brand-grey/60 mt-1">
            Try a different search or filter
          </p>
        </motion.div>
      )}

      {/* Grid View */}
      {!isLoading && viewMode === "grid" && filteredUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {filteredUsers.map((user, i) => (
            <motion.button
              key={user.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              onClick={() => handleSelectUser(user)}
              className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-brand-blue/20 transition-all text-center group"
            >
              <Avatar className="h-16 w-16 mx-auto mb-3">
                <AvatarImage
                  src={getPhotoUrl(user, 120)}
                  alt={user.displayName}
                  loading="lazy"
                  decoding="async"
                />
                <AvatarFallback className="bg-brand-blue text-white text-lg font-bold">
                  {getInitials(user.displayName)}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-sm text-gray-900 group-hover:text-brand-blue transition-colors truncate">
                {user.displayName}
              </h3>
              <p className="text-xs text-brand-grey mt-0.5 truncate">
                {user.jobTitle || "Team Member"}
              </p>
              {user.department && (
                <Badge
                  className={`mt-2 text-[10px] ${getDeptColor(user.department)}`}
                  variant="secondary"
                >
                  {user.department}
                </Badge>
              )}
              {user.officeLocation && (
                <p className="text-[11px] text-brand-grey/60 mt-1.5 flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {user.officeLocation}
                </p>
              )}
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* List View */}
      {!isLoading && viewMode === "list" && filteredUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-brand-grey uppercase tracking-wider">
            <span className="w-9" />
            <span>Name</span>
            <span>Title</span>
            <span>Department</span>
            <span>Location</span>
          </div>
          {filteredUsers.map((user, i) => (
            <motion.button
              key={user.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.02 }}
              onClick={() => handleSelectUser(user)}
              className="w-full grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-gray-50 hover:bg-blue-50/40 transition-colors items-center text-left group"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage
                  src={getPhotoUrl(user, 48)}
                  alt={user.displayName}
                  loading="lazy"
                  decoding="async"
                />
                <AvatarFallback className="bg-brand-blue/10 text-brand-blue text-xs font-semibold">
                  {getInitials(user.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-900 group-hover:text-brand-blue transition-colors truncate block">
                  {user.displayName}
                </span>
                {user.mail && (
                  <span className="text-[11px] text-brand-grey truncate block">
                    {user.mail}
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-600 truncate">
                {user.jobTitle || "—"}
              </span>
              <span>
                {user.department ? (
                  <Badge
                    className={`text-[10px] ${getDeptColor(user.department)}`}
                    variant="secondary"
                  >
                    {user.department}
                  </Badge>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </span>
              <span className="text-xs text-brand-grey truncate max-w-[140px]">
                {user.officeLocation || "—"}
              </span>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Tree / Org Chart View — Vertical Top-Down Hierarchy */}
      {!isLoading && viewMode === "tree" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
        >
          {filteredTreeUsers.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-brand-grey/30 mx-auto mb-3" />
              <p className="text-brand-grey text-sm">
                No matching directory data
              </p>
            </div>
          ) : (
            <DirectoryOrgChart
              users={filteredTreeUsers}
              onSelect={handleSelectUser}
            />
          )}
        </motion.div>
      )}

      {/* Profile Dialog */}
      <ProfileDialog
        user={selectedUser}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </div>
  );
}
