// ProConnect — Admin Closers Table Page
// Search directory for employees, assign awards, manage the awards banner

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Trophy,
  X,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface DirectoryUser {
  id: string;
  displayName: string;
  mail: string | null;
  jobTitle: string | null;
  department: string | null;
  photoUrl?: string;
  directReports?: DirectoryUser[];
}

interface CloserAward {
  id: string;
  employeeId: string | null;
  employeeName: string;
  award: string;
  color: string;
  awardFontSize: number;
  sortOrder: number;
  active: boolean;
}

function flattenTree(nodes: DirectoryUser[]): DirectoryUser[] {
  const flat: DirectoryUser[] = [];
  for (const n of nodes) {
    flat.push(n);
    if (n.directReports?.length) flat.push(...flattenTree(n.directReports));
  }
  return flat;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function AdminClosersTablePage() {
  const [awards, setAwards] = useState<CloserAward[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [dirLoading, setDirLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);
  const [awardText, setAwardText] = useState("");
  const [awardColor, setAwardColor] = useState("#f59e0b");
  const [awardFontSize, setAwardFontSize] = useState(10);
  const [showResults, setShowResults] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch awards
  useEffect(() => {
    fetch("/api/closers-table")
      .then((r) => r.json())
      .then((d) => setAwards(d.awards || []))
      .catch(() => {});
  }, []);

  // Fetch directory
  useEffect(() => {
    fetch("/api/directory?mode=tree")
      .then((r) => r.json())
      .then((d) => {
        setDirectoryUsers(d.users || []);
        setDirLoading(false);
      })
      .catch(() => setDirLoading(false));
  }, []);

  const flatUsers = useMemo(() => flattenTree(directoryUsers), [directoryUsers]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return flatUsers
      .filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          (u.jobTitle && u.jobTitle.toLowerCase().includes(q)) ||
          (u.department && u.department.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [flatUsers, searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelectUser = (user: DirectoryUser) => {
    setSelectedUser(user);
    setSearchQuery(user.displayName);
    setShowResults(false);
  };

  const handleAddAward = async () => {
    if (!selectedUser || !awardText.trim()) {
      toast.error("Select an employee and enter an award.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/closers-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedUser.id,
          employeeName: selectedUser.displayName,
          award: awardText.trim(),
          color: awardColor,
          awardFontSize,
        }),
      });

      if (!res.ok) throw new Error("Failed to create");
      const data = await res.json();
      setAwards((prev) => [...prev, data.award]);
      setSelectedUser(null);
      setSearchQuery("");
      setAwardText("");
      setAwardColor("#f59e0b");
      setAwardFontSize(10);
      toast.success(`Added ${data.award.employeeName} to Closers Table!`);
    } catch {
      toast.error("Failed to add award.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAward = async (id: string) => {
    try {
      const res = await fetch(`/api/closers-table?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setAwards((prev) => prev.filter((a) => a.id !== id));
      toast.success("Award removed.");
    } catch {
      toast.error("Failed to delete award.");
    }
  };

  const handleUpdateAward = async (id: string, updates: Partial<CloserAward>) => {
    try {
      const res = await fetch("/api/closers-table", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      setAwards((prev) => prev.map((a) => (a.id === id ? { ...a, ...data.award } : a)));
    } catch {
      toast.error("Failed to update award.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-brand-grey hover:text-brand-blue transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-500" />
          Closers Table Awards
        </h1>
        <p className="text-sm text-brand-grey mt-1">
          Recognize top closers — search by name from the company directory, assign an award, and they&apos;ll appear on the dashboard banner.
        </p>
      </div>

      {/* Add Award Form */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-8">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-4">
          Add Award
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Directory search */}
          <div ref={searchRef} className="relative">
            <label className="block text-xs font-medium text-brand-grey mb-1">
              Employee
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedUser(null);
                  setShowResults(true);
                }}
                onFocus={() => searchQuery.trim() && setShowResults(true)}
                placeholder={dirLoading ? "Loading directory…" : "Search by name…"}
                className="pl-10"
              />
              {selectedUser && (
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchQuery("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Results dropdown */}
            <AnimatePresence>
              {showResults && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                >
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={`/api/directory/photo?userId=${encodeURIComponent(user.id)}&name=${encodeURIComponent(user.displayName)}&size=96x96`}
                        />
                        <AvatarFallback className="text-xs bg-brand-blue text-white">
                          {getInitials(user.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {user.displayName}
                        </p>
                        <p className="text-xs text-brand-grey truncate">
                          {user.jobTitle || user.department || ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Award text */}
          <div>
            <label className="block text-xs font-medium text-brand-grey mb-1">
              Award
            </label>
            <Input
              value={awardText}
              onChange={(e) => setAwardText(e.target.value)}
              placeholder="e.g. Top Closer – March 2026"
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-medium text-brand-grey mb-1">
              Card Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={awardColor}
                onChange={(e) => setAwardColor(e.target.value)}
                className="h-9 w-12 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <Input
                value={awardColor}
                onChange={(e) => setAwardColor(e.target.value)}
                className="flex-1 font-mono text-sm"
                maxLength={7}
              />
            </div>
            <div className="flex gap-1.5 mt-2">
              {["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"].map((c) => (
                <button
                  key={c}
                  onClick={() => setAwardColor(c)}
                  className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: awardColor === c ? "white" : "transparent",
                    boxShadow: awardColor === c ? `0 0 0 2px ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Font size */}
          <div>
            <label className="block text-xs font-medium text-brand-grey mb-1">
              Award Text Size ({awardFontSize}px)
            </label>
            <input
              type="range"
              min={8}
              max={18}
              value={awardFontSize}
              onChange={(e) => setAwardFontSize(Number(e.target.value))}
              className="w-full accent-brand-blue"
            />
            <div className="flex justify-between text-[10px] text-brand-grey mt-0.5">
              <span>8px</span>
              <span>18px</span>
            </div>
          </div>
        </div>

        {/* Selected user preview */}
        {selectedUser && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={`/api/directory/photo?userId=${encodeURIComponent(selectedUser.id)}&name=${encodeURIComponent(selectedUser.displayName)}&size=120x120`}
              />
              <AvatarFallback className="text-xs bg-brand-blue text-white">
                {getInitials(selectedUser.displayName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {selectedUser.displayName}
              </p>
              <p className="text-xs text-brand-grey">
                {selectedUser.jobTitle}
                {selectedUser.department ? ` · ${selectedUser.department}` : ""}
              </p>
            </div>
          </div>
        )}

        <Button
          onClick={handleAddAward}
          disabled={!selectedUser || !awardText.trim() || saving}
          className="bg-brand-blue hover:bg-brand-blue/90 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          {saving ? "Adding…" : "Add to Closers Table"}
        </Button>
      </div>

      {/* Current Awards List */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-4">
          Current Awards ({awards.length})
        </h2>

        {awards.length === 0 ? (
          <p className="text-sm text-brand-grey py-8 text-center">
            No awards yet. Search for an employee above to add one.
          </p>
        ) : (
          <div className="space-y-3">
            {awards.map((award) => (
              <motion.div
                key={award.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"
              >
                <div
                  className="w-1 h-10 rounded-full shrink-0"
                  style={{ backgroundColor: award.color || "#f59e0b" }}
                />
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage
                    src={
                      award.employeeId
                        ? `/api/directory/photo?userId=${encodeURIComponent(award.employeeId)}&name=${encodeURIComponent(award.employeeName)}&size=120x120`
                        : undefined
                    }
                  />
                  <AvatarFallback className="text-xs bg-brand-blue text-white">
                    {getInitials(award.employeeName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {award.employeeName}
                  </p>
                  <p className="text-xs text-brand-grey truncate">
                    {award.award}
                  </p>
                </div>

                {/* Inline color edit */}
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="color"
                    value={award.color || "#f59e0b"}
                    onChange={(e) => handleUpdateAward(award.id, { color: e.target.value })}
                    className="h-7 w-7 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    title="Change color"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-brand-grey">{award.awardFontSize || 10}px</span>
                    <input
                      type="range"
                      min={8}
                      max={18}
                      value={award.awardFontSize || 10}
                      onChange={(e) => handleUpdateAward(award.id, { awardFontSize: Number(e.target.value) })}
                      className="w-16 accent-brand-blue"
                      title="Award text size"
                    />
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteAward(award.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
