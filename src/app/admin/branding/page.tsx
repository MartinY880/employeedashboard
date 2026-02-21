// ProConnect — Admin Branding Page
// Upload and manage site logo, favicon, and company name

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Upload,
  Trash2,
  Loader2,
  ImageIcon,
  Globe,
  Paintbrush,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSounds } from "@/components/shared/SoundProvider";
import { toast } from "sonner";

interface BrandingData {
  companyName: string;
  logoData: string | null;
  faviconData: string | null;
}

export default function AdminBrandingPage() {
  const { playClick } = useSounds();
  const [branding, setBranding] = useState<BrandingData>({
    companyName: "MortgagePros",
    logoData: null,
    faviconData: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyName, setCompanyName] = useState("MortgagePros");

  // Preview states
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeFavicon, setRemoveFavicon] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const fetchBranding = useCallback(async () => {
    try {
      const res = await fetch("/api/branding");
      if (res.ok) {
        const data = await res.json();
        setBranding(data);
        setCompanyName(data.companyName || "MortgagePros");
      }
    } catch {
      // keep defaults
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB");
      return;
    }
    setLogoFile(file);
    setRemoveLogo(false);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleFaviconSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error("Favicon must be under 1MB");
      return;
    }
    setFaviconFile(file);
    setRemoveFavicon(false);
    const reader = new FileReader();
    reader.onload = () => setFaviconPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  function handleRemoveFavicon() {
    setFaviconFile(null);
    setFaviconPreview(null);
    setRemoveFavicon(true);
    if (faviconInputRef.current) faviconInputRef.current.value = "";
  }

  async function handleSave() {
    playClick();
    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append("companyName", companyName);
      if (logoFile) formData.append("logo", logoFile);
      if (faviconFile) formData.append("favicon", faviconFile);
      if (removeLogo) formData.append("removeLogo", "true");
      if (removeFavicon) formData.append("removeFavicon", "true");

      const res = await fetch("/api/branding", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to save");
      }

      const updated = await res.json();
      setBranding(updated);
      setLogoFile(null);
      setFaviconFile(null);
      setLogoPreview(null);
      setFaviconPreview(null);
      setRemoveLogo(false);
      setRemoveFavicon(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
      if (faviconInputRef.current) faviconInputRef.current.value = "";

      // Update favicon in browser immediately
      if (updated.faviconData) {
        let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.href = updated.faviconData;
      } else if (removeFavicon) {
        const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
        if (link) link.href = "/favicon.ico";
      }

      toast.success("Branding updated successfully!");
    } catch {
      toast.error("Failed to update branding");
    } finally {
      setIsSaving(false);
    }
  }

  const currentLogo = logoPreview ?? (removeLogo ? null : branding.logoData);
  const currentFavicon = faviconPreview ?? (removeFavicon ? null : branding.faviconData);
  const hasChanges =
    companyName !== branding.companyName ||
    logoFile !== null ||
    faviconFile !== null ||
    removeLogo ||
    removeFavicon;

  if (isLoading) {
    return (
      <div className="max-w-[900px] mx-auto px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-gray-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            onClick={playClick}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-brand-grey hover:text-brand-blue hover:border-brand-blue/30 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue text-white">
            <Paintbrush className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Site Branding</h1>
            <p className="text-sm text-brand-grey">
              Customize the portal logo, favicon, and company name
            </p>
          </div>
        </div>
      </div>

      {/* Company Name */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-brand-blue" />
          <h2 className="text-lg font-bold text-gray-900">Company Name</h2>
        </div>
        <p className="text-sm text-brand-grey mb-4">
          Displayed next to the logo in the navigation bar.
        </p>
        <div className="max-w-md">
          <label htmlFor="companyName" className="text-sm font-medium text-gray-700 block mb-1.5">
            Display Name
          </label>
          <Input
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="MortgagePros"
            className="mt-1"
          />
        </div>
      </div>

      {/* Logo and Favicon Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Logo Upload */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="w-5 h-5 text-brand-blue" />
            <h2 className="text-lg font-bold text-gray-900">Logo</h2>
          </div>
          <p className="text-sm text-brand-grey mb-4">
            Appears in the top-left corner of the navigation bar. Recommended: square image, at least 64×64px. Max 2MB.
          </p>

          {/* Preview */}
          <div className="flex items-center justify-center w-full h-32 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 mb-4">
            {currentLogo ? (
              <Image
                src={currentLogo}
                alt="Logo preview"
                width={80}
                height={80}
                className="object-contain max-h-24 rounded-lg"
                unoptimized
              />
            ) : (
              <div className="flex flex-col items-center text-brand-grey">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-blue text-white font-bold text-xl">
                  {companyName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <span className="text-xs mt-2">Default text logo</span>
              </div>
            )}
          </div>

          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoSelect}
            className="hidden"
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              {currentLogo ? "Replace" : "Upload Logo"}
            </Button>
            {(currentLogo || branding.logoData) && !removeLogo && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveLogo}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Favicon Upload */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-brand-blue" />
            <h2 className="text-lg font-bold text-gray-900">Favicon</h2>
          </div>
          <p className="text-sm text-brand-grey mb-4">
            The small icon shown in browser tabs. Recommended: square image, 32×32px or 64×64px. Max 1MB.
          </p>

          {/* Preview */}
          <div className="flex items-center justify-center w-full h-32 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 mb-4">
            {currentFavicon ? (
              <div className="flex flex-col items-center gap-2">
                <Image
                  src={currentFavicon}
                  alt="Favicon preview"
                  width={48}
                  height={48}
                  className="object-contain rounded"
                  unoptimized
                />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-md border border-gray-200 shadow-sm">
                  <Image
                    src={currentFavicon}
                    alt="Tab preview"
                    width={16}
                    height={16}
                    className="object-contain"
                    unoptimized
                  />
                  <span className="text-xs text-gray-600 truncate">ProConnect</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-brand-grey">
                <Globe className="w-10 h-10 text-gray-300" />
                <span className="text-xs mt-2">Default favicon</span>
              </div>
            )}
          </div>

          <input
            ref={faviconInputRef}
            type="file"
            accept="image/*"
            onChange={handleFaviconSelect}
            className="hidden"
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => faviconInputRef.current?.click()}
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              {currentFavicon ? "Replace" : "Upload Favicon"}
            </Button>
            {(currentFavicon || branding.faviconData) && !removeFavicon && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveFavicon}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Live Preview</h2>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center gap-2.5 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100 w-fit">
            {currentLogo ? (
              <Image
                src={currentLogo}
                alt="Logo"
                width={36}
                height={36}
                className="rounded-lg object-contain"
                unoptimized
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-blue text-white font-bold text-sm">
                {companyName
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
            )}
            <span className="text-lg font-bold text-brand-blue tracking-tight">
              {companyName}
            </span>
          </div>
          {currentFavicon && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-brand-grey">Browser tab:</span>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-gray-200 shadow-sm">
                <Image
                  src={currentFavicon}
                  alt="Favicon"
                  width={14}
                  height={14}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-[11px] text-gray-500 truncate max-w-[120px]">
                  ProConnect | {companyName}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="min-w-[140px] bg-brand-blue hover:bg-brand-blue/90"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
