// ProConnect — Admin Quick Links Management Page
// CRUD table for managing dashboard quick links

"use client";

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Loader2,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  AVAILABLE_ICON_OPTIONS,
  normalizeQuickLinkIconId,
  renderQuickLinkIconPreview,
} from "@/components/widgets/QuickLinksBar";

interface QuickLinkItem {
  id: string;
  label: string;
  url: string;
  icon: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminQuickLinksPage() {
  const ICON_INITIAL_RESULTS = 80;
  const ICON_LOAD_STEP = 120;
  const ICON_MAX_RESULTS = 250;
  const ICON_MIN_QUERY_LENGTH = 2;

  const { playClick, playSuccess, playPop } = useSounds();
  const [links, setLinks] = useState<QuickLinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<QuickLinkItem | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formIcon, setFormIcon] = useState("lucide:link");
  const [iconSearch, setIconSearch] = useState("");
  const [iconMenuOpen, setIconMenuOpen] = useState(false);
  const [visibleDefaultIcons, setVisibleDefaultIcons] = useState(ICON_INITIAL_RESULTS);
  const deferredIconSearch = useDeferredValue(iconSearch);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/quicklinks?all=true");
      const data = await res.json();
      setLinks(
        (data.links || []).sort(
          (a: QuickLinkItem, b: QuickLinkItem) => a.sortOrder - b.sortOrder
        )
      );
    } catch {
      console.error("Failed to fetch quick links");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const openCreate = () => {
    setEditingLink(null);
    setFormLabel("");
    setFormUrl("");
    setFormIcon("lucide:link");
    setIconSearch("");
    setIconMenuOpen(false);
    setVisibleDefaultIcons(ICON_INITIAL_RESULTS);
    setDialogOpen(true);
    playClick();
  };

  const openEdit = (link: QuickLinkItem) => {
    setEditingLink(link);
    setFormLabel(link.label);
    setFormUrl(link.url);
    setFormIcon(link.icon.includes(":") ? link.icon : `lucide:${link.icon}`);
    setIconSearch("");
    setIconMenuOpen(false);
    setVisibleDefaultIcons(ICON_INITIAL_RESULTS);
    setDialogOpen(true);
    playClick();
  };

  const filteredIconOptions = useMemo(() => {
    if (!iconMenuOpen) return [];

    const query = deferredIconSearch.trim().toLowerCase();
    if (!query) return AVAILABLE_ICON_OPTIONS.slice(0, visibleDefaultIcons);
    if (query.length < ICON_MIN_QUERY_LENGTH) return [];

    return AVAILABLE_ICON_OPTIONS.filter((option) =>
      [option.label, option.id, ...option.keywords]
        .join(" ")
        .toLowerCase()
        .includes(query)
    ).slice(0, ICON_MAX_RESULTS);
  }, [deferredIconSearch, iconMenuOpen, visibleDefaultIcons]);

  const hasMoreDefaultIcons = useMemo(() => {
    const query = deferredIconSearch.trim();
    return !query && visibleDefaultIcons < AVAILABLE_ICON_OPTIONS.length;
  }, [deferredIconSearch, visibleDefaultIcons]);

  const groupedIconOptions = useMemo(() => {
    return {
      lucide: filteredIconOptions.filter((option) => option.library === "lucide"),
      reactIcons: filteredIconOptions.filter(
        (option) => option.library === "react-icons"
      ),
      fontAwesome: filteredIconOptions.filter(
        (option) => option.library === "fontawesome"
      ),
    };
  }, [filteredIconOptions]);

  const selectedIconOption = useMemo(() => {
    const normalized = normalizeQuickLinkIconId(formIcon);
    return (
      AVAILABLE_ICON_OPTIONS.find((option) => option.id === normalized) ??
      AVAILABLE_ICON_OPTIONS.find((option) => option.id === "lucide:link") ??
      null
    );
  }, [formIcon]);

  const selectIcon = useCallback((iconId: string) => {
    setFormIcon(iconId);
    setIconMenuOpen(false);
    setIconSearch("");
  }, []);

  const handleSave = async () => {
    if (!formLabel.trim() || !formUrl.trim()) return;
    setSaving(true);

    try {
      if (editingLink) {
        // Update
        await fetch("/api/quicklinks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingLink.id,
            label: formLabel.trim(),
            url: formUrl.trim(),
            icon: formIcon,
          }),
        });
      } else {
        // Create
        await fetch("/api/quicklinks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: formLabel.trim(),
            url: formUrl.trim(),
            icon: formIcon,
            sortOrder: links.length,
          }),
        });
      }

      playSuccess();
      setDialogOpen(false);
      fetchLinks();
    } catch {
      console.error("Failed to save link");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (link: QuickLinkItem) => {
    playPop();
    await fetch("/api/quicklinks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: link.id, active: !link.active }),
    });
    fetchLinks();
  };

  const handleDelete = async (id: string) => {
    playPop();
    await fetch(`/api/quicklinks?id=${id}`, { method: "DELETE" });
    setDeletingId(null);
    fetchLinks();
  };

  const handleMove = async (link: QuickLinkItem, direction: "up" | "down") => {
    playClick();
    const sorted = [...links].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((l) => l.id === link.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    // Swap sort orders
    await Promise.all([
      fetch("/api/quicklinks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sorted[idx].id, sortOrder: sorted[swapIdx].sortOrder }),
      }),
      fetch("/api/quicklinks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sorted[swapIdx].id, sortOrder: sorted[idx].sortOrder }),
      }),
    ]);
    fetchLinks();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-5xl mx-auto px-6 pt-8 pb-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-brand-grey hover:text-brand-blue transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-brand-blue" />
              Quick Links
            </h1>
            <p className="text-sm text-brand-grey mt-0.5">
              Manage dashboard quick links visible to all employees
            </p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="bg-brand-blue hover:bg-brand-blue/90 text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Link
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="py-16 text-center">
            <Link2 className="w-10 h-10 mx-auto mb-3 text-brand-grey/30" />
            <p className="text-brand-grey text-sm">No quick links yet</p>
            <Button onClick={openCreate} variant="outline" className="mt-4 text-sm">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Create your first link
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Order</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="w-20">Icon</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {links.map((link, i) => (
                  <motion.tr
                    key={link.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`border-b border-gray-100 dark:border-gray-800 ${!link.active ? "opacity-50" : ""}`}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => handleMove(link, "up")}
                          disabled={i === 0}
                          className="text-brand-grey hover:text-brand-blue disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMove(link, "down")}
                          disabled={i === links.length - 1}
                          className="text-brand-grey hover:text-brand-blue disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{link.label}</TableCell>
                    <TableCell>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-blue hover:underline flex items-center gap-1 max-w-[200px] truncate"
                      >
                        {link.url}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {link.icon}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={link.active ? "bg-green-100 text-green-700 text-[10px]" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 text-[10px]"}>
                        {link.active ? "Active" : "Hidden"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => handleToggle(link)}
                          title={link.active ? "Hide link" : "Show link"}
                        >
                          {link.active ? (
                            <ToggleRight className="w-4 h-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(link)}
                          title="Edit link"
                        >
                          <Pencil className="w-3.5 h-3.5 text-brand-grey" />
                        </Button>
                        {deletingId === link.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-[10px] px-2"
                              onClick={() => handleDelete(link.id)}
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px] px-2"
                              onClick={() => setDeletingId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => { setDeletingId(link.id); playClick(); }}
                            title="Delete link"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLink ? "Edit Quick Link" : "Add Quick Link"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1 block">
                Label
              </label>
              <Input
                placeholder="e.g. Company Wiki"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1 block">
                URL
              </label>
              <Input
                placeholder="https://..."
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1 block">
                Icon
              </label>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => {
                    setIconMenuOpen((open) => {
                      const nextOpen = !open;
                      if (nextOpen) {
                        setVisibleDefaultIcons(ICON_INITIAL_RESULTS);
                      } else {
                        setIconSearch("");
                      }
                      return nextOpen;
                    });
                  }}
                >
                  {selectedIconOption ? (
                    <span className="inline-flex items-center gap-2">
                      {renderQuickLinkIconPreview(selectedIconOption.id, "w-4 h-4")}
                      {selectedIconOption.label}
                    </span>
                  ) : (
                    <span>Select an icon</span>
                  )}
                  <ChevronDown className="w-4 h-4 opacity-60" />
                </Button>

                {iconMenuOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-md border bg-popover text-popover-foreground shadow-md">
                    <div className="p-1 border-b border-border">
                      <Input
                        placeholder="Search icons..."
                        value={iconSearch}
                        onChange={(e) => setIconSearch(e.target.value)}
                        className="h-8"
                        autoFocus
                      />
                    </div>
                    <div
                      className="max-h-64 overflow-y-auto p-1"
                      onScroll={(e) => {
                        if (deferredIconSearch.trim()) return;
                        const element = e.currentTarget;
                        const nearBottom =
                          element.scrollTop + element.clientHeight >= element.scrollHeight - 24;
                        if (nearBottom) {
                          setVisibleDefaultIcons((prev) =>
                            Math.min(prev + ICON_LOAD_STEP, AVAILABLE_ICON_OPTIONS.length)
                          );
                        }
                      }}
                    >
                      {iconSearch.trim().length === 1 && (
                        <div className="px-2 py-1.5 text-xs text-brand-grey">
                          Type at least 2 characters to search
                        </div>
                      )}

                      {groupedIconOptions.lucide.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-xs text-brand-grey">Lucide</div>
                          {groupedIconOptions.lucide.map((icon) => (
                            <button
                              key={icon.id}
                              type="button"
                              className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectIcon(icon.id)}
                            >
                              <span className="inline-flex items-center gap-2">
                                {renderQuickLinkIconPreview(icon.id, "w-4 h-4")}
                                {icon.label}
                              </span>
                            </button>
                          ))}
                        </>
                      )}

                      {groupedIconOptions.reactIcons.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-xs text-brand-grey">React Icons</div>
                          {groupedIconOptions.reactIcons.map((icon) => (
                            <button
                              key={icon.id}
                              type="button"
                              className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectIcon(icon.id)}
                            >
                              <span className="inline-flex items-center gap-2">
                                {renderQuickLinkIconPreview(icon.id, "w-4 h-4")}
                                {icon.label}
                              </span>
                            </button>
                          ))}
                        </>
                      )}

                      {groupedIconOptions.fontAwesome.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-xs text-brand-grey">Font Awesome</div>
                          {groupedIconOptions.fontAwesome.map((icon) => (
                            <button
                              key={icon.id}
                              type="button"
                              className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectIcon(icon.id)}
                            >
                              <span className="inline-flex items-center gap-2">
                                {renderQuickLinkIconPreview(icon.id, "w-4 h-4")}
                                {icon.label}
                              </span>
                            </button>
                          ))}
                        </>
                      )}

                      {filteredIconOptions.length === 0 && iconSearch.trim().length !== 1 && (
                        <div className="px-2 py-1.5 text-xs text-brand-grey">No icons found</div>
                      )}
                      {hasMoreDefaultIcons && (
                        <div className="px-2 py-1.5 text-xs text-brand-grey">Scroll to load more icons…</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-brand-blue hover:bg-brand-blue/90 text-white"
              disabled={saving || !formLabel.trim() || !formUrl.trim()}
              onClick={handleSave}
            >
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingLink ? "Save Changes" : "Add Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
