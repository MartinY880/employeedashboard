// ProConnect — Preferred Vendors Page
// Modern, airy, sectioned layout with clean vendor cards and subtle animations

"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  ExternalLink,
  Star,
  Briefcase,
  X,
  Phone,
  Mail,
  Globe,
  User,
  Building2,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

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

type CategoryImagesMap = Record<string, string>;

/* ─── Detail Modal ────────────────────────────────── */

function VendorModal({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasContact = vendor.contactName || vendor.contactPhone || vendor.secondaryPhone || vendor.contactEmail || vendor.website;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        {/* Accent Bar */}
        <div className="h-1 bg-gradient-to-r from-brand-blue to-purple-500" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 p-2 relative overflow-hidden">
              {vendor.logoUrl ? (
                 <img src={vendor.logoUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                <Building2 className="h-8 w-8 text-gray-300" />
              )}
            </div>
            
            <div className="min-w-0 flex-1 pt-1">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue text-[10px] font-bold uppercase tracking-wider mb-2">
                {vendor.category}
              </span>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 leading-tight">
                {vendor.name}
                {vendor.featured && <Star className="h-5 w-5 text-amber-500 fill-amber-500 shrink-0" />}
              </h2>
              {vendor.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                  {vendor.description}
                </p>
              )}
            </div>
          </div>

          <div className="h-px w-full bg-gray-100 dark:bg-gray-800" />

          {/* Contact Details */}
          {hasContact && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Contact Details</p>
              <div className="grid grid-cols-1 gap-3">
                {vendor.contactName && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow-sm text-brand-blue">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Contact Person</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{vendor.contactName}</p>
                    </div>
                  </div>
                )}
                
                {(vendor.contactPhone || vendor.secondaryPhone) && (
                  <div className="flex flex-col gap-2">
                    {vendor.contactPhone && (
                      <a href={`tel:${vendor.contactPhone}`} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow-sm text-green-600 group-hover:text-green-500 transition-colors">
                          <Phone className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{vendor.contactPhoneLabel || "Phone"}</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-blue transition-colors">{vendor.contactPhone}</p>
                        </div>
                        <ChevronRight className="ml-auto h-4 w-4 text-gray-300 group-hover:text-brand-blue" />
                      </a>
                    )}
                    {vendor.secondaryPhone && (
                      <a href={`tel:${vendor.secondaryPhone}`} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                         <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow-sm text-green-600 group-hover:text-green-500 transition-colors">
                          <Phone className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{vendor.secondaryPhoneLabel || "Phone 2"}</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-blue transition-colors">{vendor.secondaryPhone}</p>
                        </div>
                         <ChevronRight className="ml-auto h-4 w-4 text-gray-300 group-hover:text-brand-blue" />
                      </a>
                    )}
                  </div>
                )}
                
                {vendor.contactEmail && (
                  <a href={`mailto:${vendor.contactEmail}`} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow-sm text-purple-600 group-hover:text-purple-500 transition-colors">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Email</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-blue transition-colors truncate">{vendor.contactEmail}</p>
                    </div>
                    <ChevronRight className="ml-auto h-4 w-4 text-gray-300 group-hover:text-brand-blue shrink-0" />
                  </a>
                )}
                
                {vendor.website && (
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                     <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow-sm text-blue-500 group-hover:text-blue-400 transition-colors">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Website</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-blue transition-colors truncate">{vendor.website.replace(/^https?:\/\//, "")}</p>
                    </div>
                    <ExternalLink className="ml-auto h-4 w-4 text-gray-300 group-hover:text-brand-blue shrink-0" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Address */}
          {vendor.address && (
            <div className="pt-4 border-t border-dashed border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                   <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Location</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-medium whitespace-pre-line leading-relaxed">{vendor.address}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Vendor Card Component ───────────────────────── */

function VendorGridCard({ vendor, onClick }: { vendor: Vendor; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative flex flex-col items-center p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:shadow-brand-blue/5 transition-all duration-300 cursor-pointer overflow-hidden text-center h-full"
    >
      {/* Featured Badge */}
      {vendor.featured && (
        <div className="absolute top-3 right-3">
          <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 p-1.5 rounded-full shadow-sm">
            <Star className="w-3.5 h-3.5 fill-current" />
          </div>
        </div>
      )}

      {/* Logo Area */}
      <div className="relative mb-5">
        <div className="h-20 w-20 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center p-3 shadow-inner group-hover:bg-white dark:group-hover:bg-gray-700 transition-colors duration-300">
          {vendor.logoUrl ? (
            <img 
              src={vendor.logoUrl} 
              alt={vendor.name} 
              className="h-full w-full object-contain filter group-hover:brightness-110 transition-all" 
            />
          ) : (
            <Building2 className="h-8 w-8 text-gray-300 group-hover:text-brand-blue transition-colors" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="w-full flex-1 flex flex-col items-center">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 group-hover:text-brand-blue transition-colors line-clamp-2 mb-1">
          {vendor.name}
        </h3>
        
        {/* Subtle separator */}
        <div className="w-8 h-0.5 bg-gray-100 dark:bg-gray-700 rounded-full my-3 group-hover:bg-brand-blue/20 group-hover:w-12 transition-all duration-300" />

        {/* Labels or fallback */}
        {vendor.labels ? (
          <div className="flex flex-wrap justify-center gap-1.5">
            {vendor.labels.split(",").map((l: string) => l.trim()).filter(Boolean).map((label: string) => (
              <span key={label} className="inline-block px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-medium text-gray-600 dark:text-gray-400">
                {label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide opacity-80 group-hover:opacity-100 transition-opacity">
            {vendor.category}
          </p>
        )}

        {/* View Details CTA (fade in on hover) */}
        <div className="mt-4 opacity-0 transform translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
          <span className="text-xs font-semibold text-brand-blue flex items-center gap-1">
            View Details <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </motion.button>
  );
}

/* ─── Main Page ────────────────────────────────────── */

export default function PreferredVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categoryImages, setCategoryImages] = useState<CategoryImagesMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [vendorsRes, imagesRes] = await Promise.all([
          fetch("/api/preferred-vendors"),
          fetch("/api/preferred-vendors/category-images"),
        ]);
        if (vendorsRes.ok) {
          const data = await vendorsRes.json();
          setVendors(data.vendors || []);
        }
        if (imagesRes.ok) {
          const data = await imagesRes.json();
          setCategoryImages(data.images || {});
        }
      } catch {
        // keep empty
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Grouped by category logic
  const categoryGroups = useMemo(() => {
    let source = vendors;
    if (search.trim()) {
      const q = search.toLowerCase();
      source = vendors.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.description?.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q) ||
          v.labels?.toLowerCase().includes(q) ||
          v.contactName?.toLowerCase().includes(q)
      );
    }

    const groups: Record<string, Vendor[]> = {};
    for (const v of source) {
      if (!groups[v.category]) groups[v.category] = [];
      groups[v.category].push(v);
    }

    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return a.sortOrder - b.sortOrder;
      });
    }

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [vendors, search]);

  const closeModal = useCallback(() => setSelectedVendor(null), []);

  /* ─── Loading Skeleton ──────────────────────────── */

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14 py-8">
        <div className="mb-12 border-l-4 border-brand-blue pl-5 py-1">
          <Skeleton className="h-10 w-80 mb-3 rounded-lg" />
          <Skeleton className="h-5 w-[500px] rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-12">
          {Array.from({ length: 4 }).map((_, i) => (
             <div key={i}>
                <div className="flex items-center gap-4 mb-6">
                   <Skeleton className="h-12 w-12 rounded-xl" />
                   <Skeleton className="h-8 w-48 rounded-lg" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((__, j) => (
                    <Skeleton key={j} className="h-64 rounded-3xl" />
                  ))}
                </div>
             </div>
          ))}
        </div>
      </div>
    );
  }

  /* ─── Render ────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-black/20">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14 py-10">
        
        {/* Header Section */}
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 relative"
        >
          <div className="absolute -left-14 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-blue to-transparent rounded-full hidden lg:block" />
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mb-3">
            Preferred Vendors
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
            Curated list of trusted partners and service providers for our team. 
            Select a category below to find contacts.
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ delay: 0.1 }}
           className="mb-16 sticky top-4 z-30"
        >
          <div className="relative max-w-2xl mx-auto shadow-xl shadow-brand-blue/5 rounded-full">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, category, or service..."
              className="pl-12 pr-12 py-7 rounded-full border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl text-base focus-visible:ring-brand-blue focus-visible:ring-offset-2 transition-all shadow-sm focus:shadow-lg"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 pr-5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Content Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-16 pb-20">
          {categoryGroups.map(([category, catVendors], idx) => {
            const catImage = categoryImages[category];

            return (
              <motion.section
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
              >
                {/* Category Header */}
                <div className="flex items-center gap-5 mb-8 group pl-2">
                   <div className="relative">
                      <div className="absolute inset-0 bg-brand-blue/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="relative h-16 w-16 flex items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        {catImage ? (
                           <img src={catImage} alt="" className="h-full w-full object-contain p-2" />
                        ) : (
                           <Briefcase className="h-7 w-7 text-brand-blue" />
                        )}
                      </div>
                   </div>
                   
                   <div>
                      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight mb-1 group-hover:text-brand-blue transition-colors">
                        {category}
                      </h2>
                      <p className="text-sm font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        {catVendors.length} Recommend{catVendors.length !== 1 ? "ations" : "ation"}
                      </p>
                   </div>
                   
                   <div className="hidden sm:block flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent dark:from-gray-800 ml-6 mt-1" />
                </div>

                {/* Vendors Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 gap-y-6">
                  {catVendors.map((vendor) => (
                    <VendorGridCard 
                       key={vendor.id} 
                       vendor={vendor} 
                       onClick={() => setSelectedVendor(vendor)} 
                    />
                  ))}
                </div>
              </motion.section>
            );
          })}

          {/* Empty State */}
          {categoryGroups.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-gray-400 text-center"
            >
              <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-full mb-6">
                 <Search className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                 No vendors found
              </h3>
              <p className="text-base text-gray-500 max-w-md mx-auto">
                We couldn't find any vendors matching your search criteria. Try using different keywords or categories.
              </p>
              {search && (
                 <button 
                    onClick={() => setSearch("")}
                    className="mt-6 text-brand-blue font-semibold hover:underline"
                 >
                    Clear search
                 </button>
              )}
            </motion.div>
          )}
        </div>

      </div>

      <AnimatePresence>
        {selectedVendor && <VendorModal vendor={selectedVendor} onClose={closeModal} />}
      </AnimatePresence>
    </div>
  );
}
