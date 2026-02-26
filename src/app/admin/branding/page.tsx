// ProConnect — Admin Branding Page
// Upload and manage site logo, favicon, and company name

"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from "react";
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
  Mail,
  TestTube,
  Plus,
  Link2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSounds } from "@/components/shared/SoundProvider";
import { toast } from "sonner";
import {
  AVAILABLE_ICON_OPTIONS,
  renderQuickLinkIconPreview,
} from "@/components/widgets/QuickLinksBar";

interface BrandingData {
  companyName: string;
  logoData: string | null;
  faviconData: string | null;
  topNavMenu: TopNavMenuItem[];
}

interface TopNavMenuItem {
  id: string;
  label: string;
  href: string;
  active: boolean;
  sortOrder: number;
  iframeUrl?: string;
  icon?: string;
  logoUrl?: string;
}

const TOPNAV_ICON_OPTIONS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "directory", label: "Directory" },
  { value: "calendar", label: "Calendar" },
  { value: "tournament", label: "Tournament" },
  { value: "resources", label: "Resources" },
  { value: "embed", label: "Embed" },
  { value: "link", label: "Link" },
  { value: "star", label: "Star" },
  { value: "settings", label: "Settings" },
];

interface SmtpSettings {
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
  fromName: string;
}

const DEFAULT_SMTP: SmtpSettings = {
  host: "",
  port: "587",
  user: "",
  pass: "",
  from: "",
  fromName: "ProConnect",
};

const ICON_INITIAL_RESULTS = 80;
const ICON_LOAD_STEP = 120;
const ICON_MAX_RESULTS = 250;
const ICON_MIN_QUERY_LENGTH = 2;

function isQuickLinkIconId(value: string) {
  return (
    value.startsWith("lucide:") ||
    value.startsWith("react-icons:") ||
    value.startsWith("fontawesome:")
  );
}

export default function AdminBrandingPage() {
  const { playClick } = useSounds();
  const [branding, setBranding] = useState<BrandingData>({
    companyName: "MortgagePros",
    logoData: null,
    faviconData: null,
    topNavMenu: [],
  });
  const [topNavMenu, setTopNavMenu] = useState<TopNavMenuItem[]>([]);
  const [initialTopNavMenu, setInitialTopNavMenu] = useState<TopNavMenuItem[]>([]);
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>(DEFAULT_SMTP);
  const [initialSmtpSettings, setInitialSmtpSettings] = useState<SmtpSettings>(DEFAULT_SMTP);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [iconMenuOpenFor, setIconMenuOpenFor] = useState<string | null>(null);
  const [iconSearch, setIconSearch] = useState("");
  const [visibleDefaultIcons, setVisibleDefaultIcons] = useState(ICON_INITIAL_RESULTS);
  const deferredIconSearch = useDeferredValue(iconSearch);

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
        const menu = Array.isArray(data.topNavMenu) ? data.topNavMenu : [];
        setTopNavMenu(menu);
        setInitialTopNavMenu(menu);
        const smtp = { ...DEFAULT_SMTP, ...(data.smtpSettings || {}) };
        setSmtpSettings(smtp);
        setInitialSmtpSettings(smtp);
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
      if (logoFile) formData.append("logo", logoFile);
      if (faviconFile) formData.append("favicon", faviconFile);
      if (removeLogo) formData.append("removeLogo", "true");
      if (removeFavicon) formData.append("removeFavicon", "true");
      formData.append("smtpHost", smtpSettings.host);
      formData.append("smtpPort", smtpSettings.port);
      formData.append("smtpUser", smtpSettings.user);
      formData.append("smtpPass", smtpSettings.pass);
      formData.append("smtpFrom", smtpSettings.from);
      formData.append("smtpFromName", smtpSettings.fromName);
      formData.append("topNavMenu", JSON.stringify(topNavMenu.map((item, index) => ({
        ...item,
        href: item.href.startsWith("/") ? item.href : `/${item.href}`,
        sortOrder: index,
      }))));

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
      setSmtpSettings({ ...DEFAULT_SMTP, ...(updated.smtpSettings || {}) });
      setInitialSmtpSettings({ ...DEFAULT_SMTP, ...(updated.smtpSettings || {}) });
      const updatedMenu = Array.isArray(updated.topNavMenu) ? updated.topNavMenu : [];
      setTopNavMenu(updatedMenu);
      setInitialTopNavMenu(updatedMenu);
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
  const menuChanged = JSON.stringify(topNavMenu) !== JSON.stringify(initialTopNavMenu);
  const hasChanges =
    logoFile !== null ||
    faviconFile !== null ||
    removeLogo ||
    removeFavicon ||
    JSON.stringify(smtpSettings) !== JSON.stringify(initialSmtpSettings) ||
    menuChanged;

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

  function normalizeHref(href: string): string {
    const trimmed = href.trim();
    if (!trimmed) return "/dashboard";
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  function handleAddMenuItem() {
    const nextIndex = topNavMenu.length;
    setTopNavMenu((prev) => [
      ...prev,
      {
        id: `menu-${Date.now()}-${nextIndex}`,
        label: "New Menu",
        href: "/embedded",
        active: true,
        sortOrder: nextIndex,
        iframeUrl: "",
        icon: "embed",
        logoUrl: "",
      },
    ]);
  }

  function handleMenuFieldChange(id: string, field: "label" | "href" | "iframeUrl" | "icon" | "logoUrl", value: string) {
    setTopNavMenu((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === "href" ? normalizeHref(value) : value,
            }
          : item
      )
    );
  }

  function handleToggleMenuItem(id: string) {
    setTopNavMenu((prev) =>
      prev.map((item) => (item.id === id ? { ...item, active: !item.active } : item))
    );
  }

  function handleRemoveMenuItem(id: string) {
    setTopNavMenu((prev) => prev.filter((item) => item.id !== id));
  }

  function handleMoveMenuItem(id: string, direction: "up" | "down") {
    setTopNavMenu((prev) => {
      const currentIndex = prev.findIndex((item) => item.id === id);
      if (currentIndex === -1) return prev;

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
      return next;
    });
  }

  async function handleSendTestEmail() {
    if (!testEmail) return;
    setIsSendingTest(true);
    try {
      const res = await fetch("/api/calendar/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", email: testEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send test email");
      toast.success("Test email sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test email");
    } finally {
      setIsSendingTest(false);
    }
  }

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
              Customize the portal logo and favicon
            </p>
          </div>
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
                  MP
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
                MP
              </div>
            )}
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
                  ProConnect
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SMTP Settings */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-brand-blue" />
          <h2 className="text-lg font-bold text-gray-900">Email / SMTP Settings</h2>
        </div>
        <p className="text-sm text-brand-grey mb-4">
          Shared email configuration used by calendar exports and future platform email features.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">SMTP Host</label>
            <Input
              placeholder="smtp.sendgrid.net"
              value={smtpSettings.host}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Port</label>
            <Input
              placeholder="587"
              value={smtpSettings.port}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, port: e.target.value })}
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Username</label>
            <Input
              placeholder="apikey"
              value={smtpSettings.user}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={smtpSettings.pass}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">From Email</label>
            <Input
              type="email"
              placeholder="calendar@company.com"
              value={smtpSettings.from}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, from: e.target.value })}
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">From Name</label>
            <Input
              placeholder="ProConnect"
              value={smtpSettings.fromName}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, fromName: e.target.value })}
              className="text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Input
            type="email"
            placeholder="test@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="text-sm max-w-[280px]"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendTestEmail}
            disabled={isSendingTest || !testEmail || !smtpSettings.host}
            className="gap-1.5"
          >
            {isSendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
            Send Test
          </Button>
        </div>
      </div>

      {/* Top Navigation Menu */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-brand-blue" />
              <h2 className="text-lg font-bold text-gray-900">Top Navigation Menu</h2>
            </div>
            <p className="text-sm text-brand-grey mt-1">
              Add/remove links and hide/unhide items in the top navigation bar.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleAddMenuItem}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Item
          </Button>
        </div>

        <div className="space-y-2">
          {topNavMenu.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-brand-grey">
              No menu items yet. Add one to show it in the top navigation.
            </div>
          ) : (
            topNavMenu.map((item, index) => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 space-y-2 ${
                  item.active ? "border-gray-200" : "border-gray-100 bg-gray-50"
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_auto_auto] gap-2">
                  <div className="flex items-center gap-1">
                    <div className="h-7 min-w-7 px-2 rounded-md bg-gray-100 text-gray-600 text-xs font-semibold flex items-center justify-center">
                      {index + 1}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleMoveMenuItem(item.id, "up")}
                      disabled={index === 0}
                      className="px-2"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleMoveMenuItem(item.id, "down")}
                      disabled={index === topNavMenu.length - 1}
                      className="px-2"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Input
                    value={item.label}
                    onChange={(e) => handleMenuFieldChange(item.id, "label", e.target.value)}
                    placeholder="Label"
                    className="text-sm"
                  />
                  <Input
                    value={item.href}
                    onChange={(e) => handleMenuFieldChange(item.id, "href", e.target.value)}
                    placeholder="/path"
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleMenuItem(item.id)}
                    title={item.active ? "Hide" : "Unhide"}
                    className="px-3"
                  >
                    {item.active ? (
                      <>
                        <EyeOff className="w-4 h-4 mr-1.5" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-1.5" />
                        Unhide
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveMenuItem(item.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 px-3"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Remove
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    value={item.iframeUrl || ""}
                    onChange={(e) => handleMenuFieldChange(item.id, "iframeUrl", e.target.value)}
                    placeholder="https://... (optional iframe source)"
                    className="text-sm"
                  />

                  <Select
                    value={item.icon || "link"}
                    onValueChange={(value) => handleMenuFieldChange(item.id, "icon", value)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Icon" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOPNAV_ICON_OPTIONS.map((iconOption) => (
                        <SelectItem key={iconOption.value} value={iconOption.value}>
                          {iconOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between text-sm"
                      onClick={() => {
                        setIconMenuOpenFor((current) => {
                          const next = current === item.id ? null : item.id;
                          if (next) {
                            setVisibleDefaultIcons(ICON_INITIAL_RESULTS);
                          } else {
                            setIconSearch("");
                          }
                          return next;
                        });
                      }}
                    >
                      {item.logoUrl && isQuickLinkIconId(item.logoUrl) ? (
                        <span className="inline-flex items-center gap-2 min-w-0">
                          {renderQuickLinkIconPreview(item.logoUrl, "w-4 h-4")}
                          <span className="truncate">
                            {AVAILABLE_ICON_OPTIONS.find((option) => option.id === item.logoUrl)?.label || item.logoUrl}
                          </span>
                        </span>
                      ) : (
                        <span className="truncate text-brand-grey">
                          Search icon (optional nav logo)
                        </span>
                      )}
                      <ChevronDown className="w-4 h-4 opacity-60" />
                    </Button>

                    {iconMenuOpenFor === item.id && (
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
                          <button
                            type="button"
                            className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              handleMenuFieldChange(item.id, "logoUrl", "");
                              setIconMenuOpenFor(null);
                              setIconSearch("");
                            }}
                          >
                            Use default item icon
                          </button>

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
                                    handleMenuFieldChange(item.id, "logoUrl", icon.id);
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
                                    handleMenuFieldChange(item.id, "logoUrl", icon.id);
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
                                    handleMenuFieldChange(item.id, "logoUrl", icon.id);
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
              </div>
            ))
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
