// ProConnect — Admin Preferred Vendors Page
// Full CRUD management with categories, search, drag-reorder, and multi-phone support

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  Check,
  Building2,
  Eye,
  EyeOff,
  Star,
  Pencil,
  X,
  Briefcase,
  Search,
  GripVertical,
  ChevronDown,
  Copy,
  Phone,
  Mail,
  Globe,
  MapPin,
  Tag,
  Upload,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSounds } from "@/components/shared/SoundProvider";
import { toast } from "sonner";

/* ─── Types ─────────────────────────────────────────── */

interface Vendor {
  id: string;
  name: string;
  description: string | null;
  category: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactPhoneLabel: string | null;
  secondaryPhone: string | null;
  secondaryPhoneLabel: string | null;
  website: string | null;
  logoUrl: string | null;
  address: string | null;
  labels: string | null;
  notes: string | null;
  sortOrder: number;
  active: boolean;
  featured: boolean;
}

/* ─── Category Badge Colors (generated from name hash) ── */

const BADGE_PALETTES = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
];

function categoryBadgeClass(cat: string) {
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) | 0;
  return BADGE_PALETTES[Math.abs(hash) % BADGE_PALETTES.length] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}

/* ─── Form Default ──────────────────────────────────── */

const EMPTY_FORM = {
  name: "",
  description: "",
  category: "Uncategorized",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  contactPhoneLabel: "Cell",
  secondaryPhone: "",
  secondaryPhoneLabel: "Store",
  website: "",
  logoUrl: "",
  address: "",
  labels: "",
  notes: "",
  active: true,
  featured: false,
};

/* ─── Page Component ────────────────────────────────── */

export default function AdminPreferredVendorsPage() {
  const { playClick } = useSounds();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>({});
  const [uploadingCatImage, setUploadingCatImage] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const catImageInputRef = useRef<HTMLInputElement>(null);
  const [catImageTarget, setCatImageTarget] = useState<string | null>(null);

  /* ─── Fetch ─────────────────────────────────────── */

  const fetchVendors = useCallback(async () => {
    try {
      const res = await fetch("/api/preferred-vendors?all=true");
      if (res.ok) {
        const data = await res.json();
        setVendors(data.vendors || []);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
    // Load category images
    (async () => {
      try {
        const res = await fetch("/api/preferred-vendors/category-images");
        if (res.ok) {
          const data = await res.json();
          setCategoryImages(data.images || {});
        }
      } catch { /* silent */ }
    })();
  }, [fetchVendors]);

  // Click outside to close category dropdown
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ─── Derived ───────────────────────────────────── */

  // Categories are managed via the category-images store. Also include any vendor categories not yet in the store.
  const allCategories = useMemo(() => {
    const fromStore = Object.keys(categoryImages);
    const fromVendors = vendors.map((v) => v.category);
    const merged = [...new Set([...fromStore, ...fromVendors])];
    merged.sort();
    return merged;
  }, [vendors, categoryImages]);

  const filtered = useMemo(() => {
    let list = vendors;
    if (filterCategory) {
      list = list.filter((v) => v.category === filterCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q) ||
          v.contactName?.toLowerCase().includes(q) ||
          v.contactEmail?.toLowerCase().includes(q) ||
          v.labels?.toLowerCase().includes(q) ||
          v.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [vendors, search, filterCategory]);

  const stats = useMemo(() => ({
    total: vendors.length,
    active: vendors.filter((v) => v.active).length,
    featured: vendors.filter((v) => v.featured).length,
    categories: [...new Set(vendors.map((v) => v.category))].length,
  }), [vendors]);

  /* ─── Form helpers ──────────────────────────────── */

  function openCreate() {
    playClick();
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
    setExpandedId(null);
  }

  function openEdit(vendor: Vendor) {
    playClick();
    setEditId(vendor.id);
    setForm({
      name: vendor.name,
      description: vendor.description || "",
      category: vendor.category,
      contactName: vendor.contactName || "",
      contactEmail: vendor.contactEmail || "",
      contactPhone: vendor.contactPhone || "",
      contactPhoneLabel: vendor.contactPhoneLabel || "Cell",
      secondaryPhone: vendor.secondaryPhone || "",
      secondaryPhoneLabel: vendor.secondaryPhoneLabel || "Store",
      website: vendor.website || "",
      logoUrl: vendor.logoUrl || "",
      address: vendor.address || "",
      labels: vendor.labels || "",
      notes: vendor.notes || "",
      active: vendor.active,
      featured: vendor.featured,
    });
    setShowForm(true);
    setExpandedId(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm({ ...EMPTY_FORM });
  }

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function selectCategory(cat: string) {
    setForm((prev) => ({ ...prev, category: cat }));
    setShowCategoryDropdown(false);
  }

  /* ─── Logo Upload ───────────────────────────────── */

  async function handleLogoUpload(file: File) {
    setIsUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/preferred-vendors/upload-logo", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      setForm((prev) => ({ ...prev, logoUrl: data.url }));
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
    }
  }

  /* ─── Category Management ────────────────────────── */

  async function handleCreateCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (allCategories.includes(trimmed)) {
      toast.error("Category already exists");
      return;
    }
    setIsCreatingCategory(true);
    try {
      const fd = new FormData();
      fd.append("category", trimmed);
      fd.append("createOnly", "true");
      const res = await fetch("/api/preferred-vendors/category-images", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Create failed");
      const data = await res.json();
      setCategoryImages(data.images || {});
      setNewCategoryName("");
      toast.success(`Category "${trimmed}" created`);
    } catch {
      toast.error("Failed to create category");
    } finally {
      setIsCreatingCategory(false);
    }
  }

  async function handleDeleteCategory(category: string) {
    if (category === "Uncategorized") {
      toast.error("Cannot delete the Uncategorized category");
      return;
    }
    const vendorsInCat = vendors.filter((v) => v.category === category).length;
    const msg = vendorsInCat > 0
      ? `Delete "${category}"? ${vendorsInCat} vendor(s) will be moved to Uncategorized.`
      : `Delete "${category}"?`;
    if (!confirm(msg)) return;
    setDeletingCategory(category);
    try {
      const res = await fetch(`/api/preferred-vendors/category-images?category=${encodeURIComponent(category)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      const data = await res.json();
      setCategoryImages(data.images || {});
      toast.success(`Category "${category}" deleted`);
      // Refresh vendors to pick up reassignment
      if (data.reassigned) await fetchVendors();
    } catch {
      toast.error("Failed to delete category");
    } finally {
      setDeletingCategory(null);
    }
  }

  async function handleCategoryImageUpload(category: string, file: File) {
    setUploadingCatImage(category);
    try {
      const fd = new FormData();
      fd.append("category", category);
      fd.append("file", file);
      const res = await fetch("/api/preferred-vendors/category-images", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setCategoryImages(data.images || {});
      toast.success(`Category image updated for ${category}`);
    } catch {
      toast.error("Failed to upload category image");
    } finally {
      setUploadingCatImage(null);
    }
  }

  async function handleRemoveCategoryImage(category: string) {
    setUploadingCatImage(category);
    try {
      const fd = new FormData();
      fd.append("category", category);
      fd.append("remove", "true");
      const res = await fetch("/api/preferred-vendors/category-images", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Remove failed");
      const data = await res.json();
      setCategoryImages(data.images || {});
      toast.success(`Category image removed for ${category}`);
    } catch {
      toast.error("Failed to remove category image");
    } finally {
      setUploadingCatImage(null);
    }
  }

  /* ─── CRUD ──────────────────────────────────────── */

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Vendor name is required");
      return;
    }
    playClick();
    setIsSaving(true);

    const payload = {
      ...(editId ? { id: editId } : {}),
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || "General",
      contactName: form.contactName.trim() || null,
      contactEmail: form.contactEmail.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      contactPhoneLabel: form.contactPhoneLabel.trim() || null,
      secondaryPhone: form.secondaryPhone.trim() || null,
      secondaryPhoneLabel: form.secondaryPhoneLabel.trim() || null,
      website: form.website.trim() || null,
      logoUrl: form.logoUrl.trim() || null,
      address: form.address.trim() || null,
      labels: form.labels.trim() || null,
      notes: form.notes.trim() || null,
      active: form.active,
      featured: form.featured,
    };

    try {
      const res = await fetch("/api/preferred-vendors", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success(editId ? "Vendor updated" : "Vendor created");
      closeForm();
      await fetchVendors();
    } catch {
      toast.error(editId ? "Failed to update vendor" : "Failed to create vendor");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(vendor: Vendor, field: "active" | "featured") {
    playClick();
    try {
      const res = await fetch("/api/preferred-vendors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: vendor.id, [field]: !vendor[field] }),
      });
      if (!res.ok) throw new Error();
      setVendors((prev) =>
        prev.map((v) => (v.id === vendor.id ? { ...v, [field]: !v[field] } : v))
      );
    } catch {
      toast.error(`Failed to toggle ${field}`);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this vendor permanently?")) return;
    playClick();
    try {
      const res = await fetch(`/api/preferred-vendors?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Vendor deleted");
      setVendors((prev) => prev.filter((v) => v.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {
      toast.error("Failed to delete vendor");
    }
  }

  async function handleDuplicate(vendor: Vendor) {
    playClick();
    try {
      const res = await fetch("/api/preferred-vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${vendor.name} (Copy)`,
          description: vendor.description,
          category: vendor.category,
          contactName: vendor.contactName,
          contactEmail: vendor.contactEmail,
          contactPhone: vendor.contactPhone,
          contactPhoneLabel: vendor.contactPhoneLabel,
          secondaryPhone: vendor.secondaryPhone,
          secondaryPhoneLabel: vendor.secondaryPhoneLabel,
          website: vendor.website,
          logoUrl: vendor.logoUrl,
          address: vendor.address,
          labels: vendor.labels,
          notes: vendor.notes,
          active: false,
          featured: false,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Vendor duplicated");
      await fetchVendors();
    } catch {
      toast.error("Failed to duplicate vendor");
    }
  }

  /* ─── Loading skeleton ──────────────────────────── */

  if (isLoading) {
    return (
      <div className="max-w-[1000px] mx-auto px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg mb-3 animate-pulse" />
        ))}
      </div>
    );
  }

  /* ─── Render ────────────────────────────────────── */

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1000px] mx-auto px-6 py-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-500" />
              Preferred Vendors
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage company preferred vendor listings
            </p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="bg-brand-blue hover:bg-brand-blue/90"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Vendor
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-gray-700 dark:text-gray-300" },
          { label: "Active", value: stats.active, color: "text-green-600" },
          { label: "Featured", value: stats.featured, color: "text-amber-600" },
          { label: "Categories", value: stats.categories, color: "text-blue-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-gray-500 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Category Management */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
            <ImageIcon className="w-3.5 h-3.5" />
            Manage Categories
          </h2>
          <p className="text-[11px] text-gray-400">Create categories first, then assign vendors to them</p>
        </div>

        {/* Create New Category */}
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="New category name..."
            className="max-w-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateCategory();
              }
            }}
          />
          <Button
            onClick={handleCreateCategory}
            disabled={!newCategoryName.trim() || isCreatingCategory}
            className="bg-brand-blue hover:bg-brand-blue/90"
            size="sm"
          >
            {isCreatingCategory ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><Plus className="w-4 h-4 mr-1" /> Add Category</>
            )}
          </Button>
        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Hidden file input for category images */}
          <input
            ref={catImageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && catImageTarget) handleCategoryImageUpload(catImageTarget, file);
              e.target.value = "";
              setCatImageTarget(null);
            }}
          />
          {allCategories.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-8 text-gray-400">
              <Briefcase className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No categories yet. Create one above to get started.</p>
            </div>
          )}
          {allCategories.map((cat) => {
            const img = categoryImages[cat];
            const isUploading = uploadingCatImage === cat;
            const isDeleting = deletingCategory === cat;
            const vendorCount = vendors.filter((v) => v.category === cat).length;
            return (
              <div key={cat} className="flex flex-col items-center gap-2 p-3 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 relative group">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                  {img ? (
                    <img src={img} alt={cat} className="h-full w-full object-contain p-1" />
                  ) : (
                    <Briefcase className="h-6 w-6 text-gray-300" />
                  )}
                </div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center leading-tight">{cat}</p>
                <p className="text-[10px] text-gray-400">{vendorCount} vendor{vendorCount !== 1 ? "s" : ""}</p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    disabled={isUploading || isDeleting}
                    onClick={() => {
                      setCatImageTarget(cat);
                      catImageInputRef.current?.click();
                    }}
                  >
                    {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  </Button>
                  {img && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-1.5 text-red-500 hover:text-red-600"
                      disabled={isUploading || isDeleting}
                      onClick={() => handleRemoveCategoryImage(cat)}
                      title="Remove image"
                    >
                      <ImageIcon className="w-3 h-3" />
                      <X className="w-2 h-2 -ml-0.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    disabled={isUploading || isDeleting}
                    onClick={() => handleDeleteCategory(cat)}
                    title={`Delete category${vendorCount > 0 ? ` (${vendorCount} vendors will move to Uncategorized)` : ""}`}
                  >
                    {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors..."
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterCategory(null)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
              !filterCategory
                ? "bg-brand-blue text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {[...new Set(vendors.map((v) => v.category))].sort().map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                filterCategory === cat
                  ? "bg-brand-blue text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Create / Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5" />
                  {editId ? "Edit Vendor" : "New Vendor"}
                </h2>
                <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Row 1: Name + Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Vendor Name *</label>
                  <Input
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="e.g. Dash Diamonds"
                  />
                </div>
                <div ref={catRef} className="relative">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Category</label>
                  <button
                    type="button"
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm text-left flex items-center justify-between"
                  >
                    <span className={form.category ? "text-gray-900 dark:text-gray-100" : "text-gray-400"}>
                      {form.category || "Select category"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  {showCategoryDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg max-h-64 overflow-auto">
                      {allCategories.length === 0 && (
                        <div className="px-3 py-4 text-center text-xs text-gray-400">
                          No categories created yet. Add one in the Manage Categories section above.
                        </div>
                      )}
                      {allCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => selectCategory(cat)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between ${
                            form.category === cat ? "bg-blue-50 dark:bg-blue-950 text-brand-blue font-medium" : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <span>{cat}</span>
                          {form.category === cat && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Description */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
                <Input
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Brief description of services"
                />
              </div>

              {/* Row 3: Contact Info */}
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Contact Information</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">POC / Contact Name</label>
                    <Input
                      value={form.contactName}
                      onChange={(e) => updateField("contactName", e.target.value)}
                      placeholder="e.g. Troy Depanicis"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                    <Input
                      value={form.contactEmail}
                      onChange={(e) => updateField("contactEmail", e.target.value)}
                      placeholder="contact@vendor.com"
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Phone Numbers */}
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Phone Numbers</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex gap-2">
                    <div className="w-28 shrink-0">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Label</label>
                      <select
                        value={form.contactPhoneLabel}
                        onChange={(e) => updateField("contactPhoneLabel", e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                      >
                        <option value="Cell">Cell</option>
                        <option value="Phone">Phone</option>
                        <option value="Store">Store</option>
                        <option value="Direct">Direct</option>
                        <option value="Office">Office</option>
                        <option value="Work">Work</option>
                        <option value="Mobile">Mobile</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Primary Phone</label>
                      <Input
                        value={form.contactPhone}
                        onChange={(e) => updateField("contactPhone", e.target.value)}
                        placeholder="248-410-2926"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-28 shrink-0">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Label</label>
                      <select
                        value={form.secondaryPhoneLabel}
                        onChange={(e) => updateField("secondaryPhoneLabel", e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                      >
                        <option value="Store">Store</option>
                        <option value="Direct">Direct</option>
                        <option value="Office">Office</option>
                        <option value="Cell">Cell</option>
                        <option value="Phone">Phone</option>
                        <option value="Work">Work</option>
                        <option value="Mobile">Mobile</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Secondary Phone</label>
                      <Input
                        value={form.secondaryPhone}
                        onChange={(e) => updateField("secondaryPhone", e.target.value)}
                        placeholder="248-646-0535"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 5: Website + Logo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Website</label>
                  <Input
                    value={form.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    placeholder="https://vendor.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Vendor Logo</label>
                  <div className="flex items-center gap-3">
                    {form.logoUrl ? (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden p-1">
                        <img src={form.logoUrl} alt="" className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                        <Building2 className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      className="h-8 text-xs"
                    >
                      {isUploadingLogo ? (
                        <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="w-3 h-3 mr-1.5" /> {form.logoUrl ? "Change" : "Upload"}</>
                      )}
                    </Button>
                    {form.logoUrl && (
                      <button
                        type="button"
                        onClick={() => updateField("logoUrl", "")}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Remove logo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Address</label>
                <Input
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder="123 Main St, City, MI 48009"
                />
              </div>

              {/* Labels */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Labels</label>
                <Input
                  value={form.labels}
                  onChange={(e) => updateField("labels", e.target.value)}
                  placeholder="e.g. Tailor, Jewelry, Clothing (comma separated)"
                />
                <p className="text-[10px] text-gray-400 mt-1">Comma-separated tags shown on the vendor card (e.g. &quot;Car Detailer, House Cleaning&quot;)</p>
              </div>

              {/* Row 6: Notes */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Internal Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Notes visible only to admins..."
                  rows={2}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none"
                />
              </div>

              {/* Row 7: Flags */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => updateField("active", e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Eye className="w-3.5 h-3.5 text-green-500" />
                  Active (visible to users)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => updateField("featured", e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  Featured (shown first)
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={closeForm}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-brand-blue hover:bg-brand-blue/90"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" />
                      {editId ? "Update Vendor" : "Create Vendor"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vendor List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Building2 className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {search || filterCategory ? "No vendors match your filters" : "No vendors yet"}
            </p>
            <p className="text-xs mt-1">
              {search || filterCategory
                ? "Try adjusting your search or filter"
                : "Click \"Add Vendor\" to create your first listing."}
            </p>
          </div>
        )}

        <AnimatePresence>
          {filtered.map((vendor) => {
            const isExpanded = expandedId === vendor.id;
            return (
              <motion.div
                key={vendor.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`bg-white dark:bg-gray-900 rounded-xl border shadow-sm transition-all ${
                  vendor.active
                    ? "border-gray-200 dark:border-gray-700"
                    : "border-gray-200 dark:border-gray-700 opacity-50"
                }`}
              >
                {/* Compact row */}
                <div className="flex items-center gap-3 p-4">
                  <GripVertical className="w-4 h-4 text-gray-300 shrink-0 cursor-grab" />

                  <div
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : vendor.id)}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500">
                      {vendor.logoUrl ? (
                        <img src={vendor.logoUrl} alt="" className="h-7 w-7 rounded object-contain" />
                      ) : (
                        <Building2 className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                          {vendor.name}
                        </h3>
                        {vendor.featured && (
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                        <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${categoryBadgeClass(vendor.category)}`}>
                          {vendor.category}
                        </span>
                        {vendor.labels && vendor.labels.split(",").map((l: string) => l.trim()).filter(Boolean).map((label: string) => (
                          <span key={label} className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            {label}
                          </span>
                        ))}
                        {!vendor.active && (
                          <Badge variant="secondary" className="text-[10px]">Hidden</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400">
                        {vendor.contactName && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">POC:</span> {vendor.contactName}
                          </span>
                        )}
                        {vendor.contactPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {vendor.contactPhone}
                          </span>
                        )}
                        {vendor.contactEmail && (
                          <span className="flex items-center gap-1 hidden sm:flex">
                            <Mail className="h-3 w-3" /> {vendor.contactEmail}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(vendor, "featured")} title={vendor.featured ? "Unfeature" : "Feature"} className="h-8 w-8 p-0">
                      <Star className={`w-4 h-4 ${vendor.featured ? "text-amber-500 fill-amber-500" : "text-gray-300"}`} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(vendor, "active")} title={vendor.active ? "Hide" : "Show"} className="h-8 w-8 p-0">
                      {vendor.active ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(vendor)} title="Edit" className="h-8 w-8 p-0">
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDuplicate(vendor)} title="Duplicate" className="h-8 w-8 p-0">
                      <Copy className="w-4 h-4 text-gray-400" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(vendor.id)} title="Delete" className="h-8 w-8 p-0 text-red-500 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0 border-t border-dashed border-gray-200 dark:border-gray-700 mt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 pt-4 text-sm">
                          {vendor.description && (
                            <div className="md:col-span-2 mb-2">
                              <p className="text-gray-600 dark:text-gray-400 text-[13px]">{vendor.description}</p>
                            </div>
                          )}
                          {vendor.contactName && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 w-20 shrink-0 text-xs font-medium">POC:</span>
                              <span className="text-gray-900 dark:text-gray-100">{vendor.contactName}</span>
                            </div>
                          )}
                          {vendor.contactPhone && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 w-20 shrink-0 text-xs font-medium">{vendor.contactPhoneLabel || "Phone"}:</span>
                              <a href={`tel:${vendor.contactPhone}`} className="text-brand-blue hover:underline">{vendor.contactPhone}</a>
                            </div>
                          )}
                          {vendor.secondaryPhone && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 w-20 shrink-0 text-xs font-medium">{vendor.secondaryPhoneLabel || "Phone 2"}:</span>
                              <a href={`tel:${vendor.secondaryPhone}`} className="text-brand-blue hover:underline">{vendor.secondaryPhone}</a>
                            </div>
                          )}
                          {vendor.contactEmail && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 w-20 shrink-0 text-xs font-medium">Email:</span>
                              <a href={`mailto:${vendor.contactEmail}`} className="text-brand-blue hover:underline break-all">{vendor.contactEmail}</a>
                            </div>
                          )}
                          {vendor.website && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 w-20 shrink-0 text-xs font-medium">Website:</span>
                              <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline break-all inline-flex items-center gap-1">
                                {vendor.website.replace(/^https?:\/\//, "")}
                                <Globe className="h-3 w-3 shrink-0" />
                              </a>
                            </div>
                          )}
                          {vendor.address && (
                            <div className="flex items-start gap-2 md:col-span-2">
                              <span className="text-gray-400 w-20 shrink-0 text-xs font-medium mt-0.5">Address:</span>
                              <span className="text-gray-700 dark:text-gray-300 flex items-start gap-1">
                                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
                                {vendor.address}
                              </span>
                            </div>
                          )}
                          {vendor.notes && (
                            <div className="md:col-span-2 mt-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-0.5">Admin Notes</p>
                              <p className="text-sm text-amber-900 dark:text-amber-200">{vendor.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer count */}
      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 text-center pt-2">
          Showing {filtered.length} of {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}
        </p>
      )}
    </motion.div>
  );
}
