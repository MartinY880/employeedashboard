// ProConnect — Admin Pillars Management
// Full CRUD for company pillar cards displayed on the dashboard

"use client";

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Shield,
  Save,
  Plus,
  Trash2,
  GripVertical,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ICON_MAP, type PillarData, type PillarIconName, type PillarHeader } from "@/lib/pillar-icons";
import {
  AVAILABLE_ICON_OPTIONS,
  normalizeQuickLinkIconId,
  renderQuickLinkIconPreview,
} from "@/components/widgets/QuickLinksBar";

const DEFAULT_HEADER: PillarHeader = {
  title: "OUR COMPANY PILLARS",
  subtitle: "The core values that drive everything we do at MortgagePros",
  maxWidth: 1400,
};

const ICON_INITIAL_RESULTS = 80;
const ICON_LOAD_STEP = 120;
const ICON_MAX_RESULTS = 250;
const ICON_MIN_QUERY_LENGTH = 2;

function renderPillarIconPreview(icon: string, className = "w-4 h-4") {
  const legacyIcon = ICON_MAP[icon as PillarIconName];
  if (legacyIcon) {
    const LegacyIcon = legacyIcon;
    return <LegacyIcon className={className} />;
  }
  return renderQuickLinkIconPreview(icon, className);
}

export default function AdminPillarsPage() {
  const [pillars, setPillars] = useState<PillarData[]>([]);
  const [header, setHeader] = useState<PillarHeader>(DEFAULT_HEADER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [iconMenuOpenFor, setIconMenuOpenFor] = useState<string | null>(null);
  const [iconSearch, setIconSearch] = useState("");
  const [visibleDefaultIcons, setVisibleDefaultIcons] = useState(ICON_INITIAL_RESULTS);
  const deferredIconSearch = useDeferredValue(iconSearch);

  // Dashboard visibility toggle
  const [showOnDashboard, setShowOnDashboard] = useState<boolean | null>(null);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  useEffect(() => {
    async function fetchVisibility() {
      try {
        const res = await fetch("/api/dashboard-settings/visibility");
        if (res.ok) {
          const data = await res.json();
          setShowOnDashboard(data.showCompanyPillars !== false);
        }
      } catch { /* keep null */ }
    }
    fetchVisibility();
  }, []);

  async function toggleVisibility() {
    const next = !showOnDashboard;
    setTogglingVisibility(true);
    try {
      const res = await fetch("/api/dashboard-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "showCompanyPillars", value: next }),
      });
      if (res.ok) {
        setShowOnDashboard(next);
        toast.success(next ? "Company Pillars shown on dashboard" : "Company Pillars hidden from dashboard");
      } else {
        toast.error("Failed to update visibility");
      }
    } catch {
      toast.error("Failed to update visibility");
    } finally {
      setTogglingVisibility(false);
    }
  }

  const fetchPillars = useCallback(async () => {
    try {
      const res = await fetch("/api/pillars");
      const data = await res.json();
      if (data && data.pillars && Array.isArray(data.pillars)) {
        setPillars(data.pillars);
        if (data.header) setHeader(data.header);
      } else if (Array.isArray(data)) {
        setPillars(data);
      }
    } catch {
      // Keep current state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPillars();
  }, [fetchPillars]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save pillars and header in parallel
      const [pillarsRes, headerRes] = await Promise.all([
        fetch("/api/pillars", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pillars),
        }),
        fetch("/api/pillars", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(header),
        }),
      ]);
      if (pillarsRes.ok && headerRes.ok) {
        setSaved(true);
        setHasChanges(false);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // Handle error silently
    } finally {
      setSaving(false);
    }
  };

  const addPillar = () => {
    const newPillar: PillarData = {
      id: `p${Date.now()}`,
      icon: "Star",
      title: "New Pillar",
      message: "Enter the pillar description here.",
    };
    setPillars((prev) => [...prev, newPillar]);
    setHasChanges(true);
  };

  const updatePillar = (id: string, field: keyof PillarData, value: string) => {
    setPillars((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
    setHasChanges(true);
  };

  const deletePillar = (id: string) => {
    setPillars((prev) => prev.filter((p) => p.id !== id));
    setDeleteId(null);
    setHasChanges(true);
  };

  const handleReorder = (newOrder: PillarData[]) => {
    setPillars(newOrder);
    setHasChanges(true);
  };

  const filteredIconOptions = useMemo(() => {
    if (!iconMenuOpenFor) return [];

    const query = deferredIconSearch.trim().toLowerCase();
    if (!query) return AVAILABLE_ICON_OPTIONS.slice(0, visibleDefaultIcons);
    if (query.length < ICON_MIN_QUERY_LENGTH) return [];

    return AVAILABLE_ICON_OPTIONS.filter((option) =>
      [option.label, option.id, ...option.keywords]
        .join(" ")
        .toLowerCase()
        .includes(query)
    ).slice(0, ICON_MAX_RESULTS);
  }, [deferredIconSearch, iconMenuOpenFor, visibleDefaultIcons]);

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

  if (loading) {
    return (
      <div className="max-w-[900px] mx-auto px-6 py-6">
        <div className="flex items-center gap-2 text-brand-grey">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading pillars…</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[900px] mx-auto px-6 py-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-brand-blue hover:border-brand-blue/30 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue text-white">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Company Pillars</h1>
            <p className="text-sm text-brand-grey">
              Edit the pillar cards displayed on the dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleVisibility}
            disabled={showOnDashboard === null || togglingVisibility}
            className={showOnDashboard === false ? "border-red-200 text-red-600 hover:bg-red-50" : ""}
          >
            {showOnDashboard === null || togglingVisibility ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : showOnDashboard ? (
              <Eye className="w-4 h-4 mr-1.5" />
            ) : (
              <EyeOff className="w-4 h-4 mr-1.5" />
            )}
            {showOnDashboard === null ? "Loading…" : showOnDashboard ? "Visible" : "Hidden"}
          </Button>
          <Button variant="outline" size="sm" onClick={addPillar}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Pillar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="bg-brand-blue hover:bg-brand-blue/90 text-white min-w-[100px]"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1.5" />
                Save All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Header Editor */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Pillar Header Banner</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">
              Title
            </label>
            <Input
              value={header.title}
              onChange={(e) => {
                setHeader((prev) => ({ ...prev, title: e.target.value }));
                setHasChanges(true);
              }}
              placeholder="Header title"
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">
              Subtitle
            </label>
            <Input
              value={header.subtitle}
              onChange={(e) => {
                setHeader((prev) => ({ ...prev, subtitle: e.target.value }));
                setHasChanges(true);
              }}
              placeholder="Header subtitle"
              className="h-9"
            />
          </div>
        </div>

        {/* Max Width Slider */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">
            Container Width — {header.maxWidth ?? 1400}px
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 w-10">600</span>
            <input
              type="range"
              min={600}
              max={1920}
              step={10}
              value={header.maxWidth ?? 1400}
              onChange={(e) => {
                setHeader((prev) => ({ ...prev, maxWidth: Number(e.target.value) }));
                setHasChanges(true);
              }}
              className="flex-1 h-2 accent-brand-blue cursor-pointer"
            />
            <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 w-10 text-right">1920</span>
          </div>
        </div>

        {/* Font Size Controls */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-1">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Font Sizes</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Banner Title Size */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">
                Banner Title — {header.bannerTitleSize ?? 14}px
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 w-6">8</span>
                <input
                  type="range"
                  min={8}
                  max={28}
                  step={1}
                  value={header.bannerTitleSize ?? 14}
                  onChange={(e) => {
                    setHeader((prev) => ({ ...prev, bannerTitleSize: Number(e.target.value) }));
                    setHasChanges(true);
                  }}
                  className="flex-1 h-2 accent-brand-blue cursor-pointer"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 w-6 text-right">28</span>
              </div>
            </div>

            {/* Banner Subtitle Size */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">
                Banner Subtitle — {header.bannerSubtitleSize ?? 11}px
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 w-6">8</span>
                <input
                  type="range"
                  min={8}
                  max={24}
                  step={1}
                  value={header.bannerSubtitleSize ?? 11}
                  onChange={(e) => {
                    setHeader((prev) => ({ ...prev, bannerSubtitleSize: Number(e.target.value) }));
                    setHasChanges(true);
                  }}
                  className="flex-1 h-2 accent-brand-blue cursor-pointer"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 w-6 text-right">24</span>
              </div>
            </div>

            {/* Card Title Size */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">
                Card Titles — {header.cardTitleSize ?? 14}px
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 w-6">8</span>
                <input
                  type="range"
                  min={8}
                  max={24}
                  step={1}
                  value={header.cardTitleSize ?? 14}
                  onChange={(e) => {
                    setHeader((prev) => ({ ...prev, cardTitleSize: Number(e.target.value) }));
                    setHasChanges(true);
                  }}
                  className="flex-1 h-2 accent-brand-blue cursor-pointer"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 w-6 text-right">24</span>
              </div>
            </div>

            {/* Card Message Size */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">
                Card Messages — {header.cardMessageSize ?? 11}px
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 w-6">8</span>
                <input
                  type="range"
                  min={8}
                  max={20}
                  step={1}
                  value={header.cardMessageSize ?? 11}
                  onChange={(e) => {
                    setHeader((prev) => ({ ...prev, cardMessageSize: Number(e.target.value) }));
                    setHasChanges(true);
                  }}
                  className="flex-1 h-2 accent-brand-blue cursor-pointer"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 w-6 text-right">20</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          You have unsaved changes. Click &quot;Save All&quot; to apply.
        </motion.div>
      )}

      {/* Pillar list */}
      <Reorder.Group
        axis="y"
        values={pillars}
        onReorder={handleReorder}
        className="space-y-3"
      >
        <AnimatePresence mode="popLayout">
          {pillars.map((pillar, index) => {
            const normalizedIcon = normalizeQuickLinkIconId(pillar.icon);
            const selectedIconOption =
              AVAILABLE_ICON_OPTIONS.find((option) => option.id === normalizedIcon) ?? null;
            const selectedLabel = selectedIconOption
              ? selectedIconOption.label
              : (pillar.icon ? `Legacy: ${pillar.icon}` : "Select an icon");

            return (
              <Reorder.Item
                key={pillar.id}
                value={pillar}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 hover:shadow-md hover:border-brand-blue/15 transition-all"
              >
                <div className="flex items-start gap-3">
                  {/* Drag handle */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 mt-1">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Icon preview */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-[#084f96] text-white shrink-0 mt-1">
                    {renderPillarIconPreview(pillar.icon, "w-6 h-6")}
                  </div>

                  {/* Fields */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Icon selector */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">
                          Icon
                        </label>
                        <div className="relative">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 w-full justify-between"
                            onClick={() => {
                              setIconMenuOpenFor((current) => {
                                const next = current === pillar.id ? null : pillar.id;
                                if (next) {
                                  setVisibleDefaultIcons(ICON_INITIAL_RESULTS);
                                } else {
                                  setIconSearch("");
                                }
                                return next;
                              });
                            }}
                          >
                            <span className="inline-flex items-center gap-2 min-w-0">
                              {renderPillarIconPreview(pillar.icon, "w-4 h-4")}
                              <span className="truncate">{selectedLabel}</span>
                            </span>
                            <ChevronDown className="w-4 h-4 opacity-60" />
                          </Button>

                          {iconMenuOpenFor === pillar.id && (
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
                                        onClick={() => {
                                          updatePillar(pillar.id, "icon", icon.id);
                                          setIconMenuOpenFor(null);
                                          setIconSearch("");
                                        }}
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
                                        onClick={() => {
                                          updatePillar(pillar.id, "icon", icon.id);
                                          setIconMenuOpenFor(null);
                                          setIconSearch("");
                                        }}
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
                                        onClick={() => {
                                          updatePillar(pillar.id, "icon", icon.id);
                                          setIconMenuOpenFor(null);
                                          setIconSearch("");
                                        }}
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

                      {/* Title */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">
                          Title
                        </label>
                        <Input
                          value={pillar.title}
                          onChange={(e) =>
                            updatePillar(pillar.id, "title", e.target.value)
                          }
                          placeholder="Pillar title"
                          className="h-9"
                        />
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">
                        Message
                      </label>
                      <Textarea
                        value={pillar.message}
                        onChange={(e) =>
                          updatePillar(pillar.id, "message", e.target.value)
                        }
                        placeholder="Pillar description…"
                        rows={2}
                        className="resize-none text-sm"
                      />
                    </div>
                  </div>

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(pillar.id)}
                    className="text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 shrink-0 mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Reorder.Item>
            );
          })}
        </AnimatePresence>
      </Reorder.Group>

      {/* Empty state */}
      {pillars.length === 0 && (
        <div className="text-center py-12 text-brand-grey">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No pillars yet</p>
          <p className="text-sm mt-1">Click &quot;Add Pillar&quot; to create your first company pillar.</p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Pillar</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this pillar? This action cannot be undone after saving.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deletePillar(deleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
