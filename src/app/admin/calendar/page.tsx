// ProConnect — Admin Calendar / Holiday Management
// Full CRUD, API settings, category labels, export/email

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ArrowLeft,
  RefreshCw,
  Download,
  Flag,
  PartyPopper,
  Building2,
  Search,
  Filter,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Settings,
  Send,
  FileDown,
  Globe,
  Key,
  Tag,
  Power,
  PowerOff,
  ChevronLeft,
  ChevronRight,
  Save,
  AlertTriangle,
  Upload,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSounds } from "@/components/shared/SoundProvider";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Holiday {
  id: string;
  title: string;
  date: string;
  category: string;
  color: string;
  source: string;
  visible: boolean;
  recurring: boolean;
  createdAt: string;
  updatedAt: string;
}

interface HolidayStats {
  total: number;
  federal: number;
  fun: number;
  company: number;
  hidden: number;
  year: string;
}

interface SyncLog {
  id: string;
  source: string;
  status: string;
  message: string | null;
  syncedAt: string;
}

interface FormData {
  title: string;
  date: string;
  category: string;
  color: string;
  visible: boolean;
  recurring: boolean;
}

interface ApiConfig {
  id: string;
  name: string;
  enabled: boolean;
  type: "nager" | "calendarific" | "abstract" | "custom";
  endpoint: string;
  apiKey: string;
  country: string;
  color: string;
  category: string;
  typeFilter: string;
  dateField?: string;
  titleField?: string;
  responsePathToHolidays?: string;
}

interface CategoryLabels {
  federal: string;
  fun: string;
  company: string;
}

interface CategoryColors {
  federal: string;
  fun: string;
  company: string;
}

const DEFAULT_FORM: FormData = {
  title: "",
  date: "",
  category: "company",
  color: "#06427F",
  visible: true,
  recurring: false,
};

const DEFAULT_API: ApiConfig = {
  id: "",
  name: "",
  enabled: true,
  type: "custom",
  endpoint: "",
  apiKey: "",
  country: "US",
  color: "#06427F",
  category: "company",
  typeFilter: "",
};

const CATEGORIES = [
  { key: "federal", label: "Federal", icon: Flag, color: "#1e40af" },
  { key: "company", label: "Company", icon: Building2, color: "#06427F" },
  { key: "fun", label: "Fun", icon: PartyPopper, color: "#16a34a" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  federal: "#1e40af",
  company: "#06427F",
  fun: "#16a34a",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
}

function getCategoryBadgeStyle(color: string) {
  const rgb = hexToRgb(color);
  if (!rgb) return { backgroundColor: "#f3f4f6", color: "#374151" };
  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`,
    color,
  };
}

const API_TYPE_LABELS: Record<string, string> = {
  nager: "Nager.Date",
  calendarific: "Calendarific",
  abstract: "Abstract API",
  custom: "Custom",
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type TabKey = "holidays" | "settings" | "export" | "sync";

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AdminCalendarPage() {
  const { playClick, playSuccess, playNotify } = useSounds();

  // ── Data ─────────────────────────────────────────────────
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [stats, setStats] = useState<HolidayStats | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Holidays tab state ───────────────────────────────────
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("holidays");

  // ── Settings tab state ───────────────────────────────────
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [categoryLabels, setCategoryLabels] = useState<CategoryLabels>({ federal: "Federal", fun: "Fun", company: "Company" });
  const [categoryColors, setCategoryColors] = useState<CategoryColors>({
    federal: CATEGORY_COLORS.federal,
    fun: CATEGORY_COLORS.fun,
    company: CATEGORY_COLORS.company,
  });
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [editingApi, setEditingApi] = useState<ApiConfig | null>(null);
  const [apiForm, setApiForm] = useState<ApiConfig>(DEFAULT_API);
  const [settingsSaving, setSettingsSaving] = useState<string | null>(null);
  const [settingsMsg, setSettingsMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [calendarExportLogoData, setCalendarExportLogoData] = useState<string | null>(null);
  const [calendarExportLogoPreview, setCalendarExportLogoPreview] = useState<string | null>(null);
  const [removeCalendarExportLogo, setRemoveCalendarExportLogo] = useState(false);
  const calendarLogoInputRef = useRef<HTMLInputElement>(null);

  // ── Export tab state ─────────────────────────────────────
  const [exportMonth, setExportMonth] = useState(new Date().getMonth());
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportLayout, setExportLayout] = useState<"list" | "calendar">("calendar");
  const [exportRecipients, setExportRecipients] = useState("");
  const [exportSubject, setExportSubject] = useState("Company Holiday Calendar");
  const [exportHeaderText, setExportHeaderText] = useState("");
  const [exportFooterText, setExportFooterText] = useState("");
  const [isSendingExport, setIsSendingExport] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Fetch holidays + stats ───────────────────────────────
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const year = new Date().getFullYear().toString();
      const [holidaysRes, statsRes, logsRes] = await Promise.all([
        fetch(`/api/calendar?year=${year}&includeHidden=true`),
        fetch(`/api/calendar?stats=true&year=${year}`),
        fetch(`/api/calendar/sync?limit=10`),
      ]);
      const [holidaysData, statsData, logsData] = await Promise.all([
        holidaysRes.json(),
        statsRes.json(),
        logsRes.json(),
      ]);
      if (Array.isArray(holidaysData)) setHolidays(holidaysData);
      if (statsData && !statsData.error) setStats(statsData);
      if (Array.isArray(logsData)) setSyncLogs(logsData);
    } catch (err) {
      console.error("Failed to fetch calendar data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar/settings");
      const data = await res.json();
      if (data.holiday_api_configs) setApiConfigs(data.holiday_api_configs);
      if (data.category_labels) {
        setCategoryLabels((prev) => ({ ...prev, ...data.category_labels }));
      }
      if (data.category_colors) {
        setCategoryColors((prev) => ({ ...prev, ...data.category_colors }));
      }
      if (typeof data.calendar_export_logo === "string" || data.calendar_export_logo === null) {
        setCalendarExportLogoData(data.calendar_export_logo || null);
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchSettings();
  }, [fetchAll, fetchSettings]);

  // ── Filtered holidays ────────────────────────────────────
  const filtered = holidays.filter((h) => {
    if (filterCategory !== "all" && h.category !== filterCategory) return false;
    if (searchTerm && !h.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // ── Holidays for export preview ──────────────────────────
  const exportHolidays = holidays.filter((h) => {
    if (!h.visible) return false;
    const d = new Date(h.date + "T00:00:00");
    return d.getMonth() === exportMonth && d.getFullYear() === exportYear;
  });

  // ── Create / Update Holiday ──────────────────────────────
  const openCreate = () => {
    setEditingHoliday(null);
    setFormData(DEFAULT_FORM);
    setIsModalOpen(true);
    playClick();
  };

  const openEdit = (h: Holiday) => {
    setEditingHoliday(h);
    setFormData({
      title: h.title,
      date: h.date,
      category: h.category,
      color: h.color,
      visible: h.visible,
      recurring: h.recurring,
    });
    setIsModalOpen(true);
    playClick();
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.date || !formData.category) return;
    setIsSubmitting(true);
    try {
      if (editingHoliday) {
        const res = await fetch("/api/calendar", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingHoliday.id, ...formData }),
        });
        if (!res.ok) throw new Error("Update failed");
      } else {
        const res = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Create failed");
      }
      playSuccess();
      setIsModalOpen(false);
      fetchAll();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Toggle Visibility ────────────────────────────────────
  const toggleVisibility = async (h: Holiday) => {
    try {
      await fetch("/api/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: h.id, visible: !h.visible }),
      });
      playClick();
      fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  // ── Delete ───────────────────────────────────────────────
  const confirmDelete = (h: Holiday) => {
    setDeletingHoliday(h);
    setIsDeleteOpen(true);
    playClick();
  };

  const handleDelete = async () => {
    if (!deletingHoliday) return;
    setIsSubmitting(true);
    try {
      await fetch(`/api/calendar?id=${deletingHoliday.id}`, { method: "DELETE" });
      playNotify();
      setIsDeleteOpen(false);
      setDeletingHoliday(null);
      fetchAll();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Sync All Enabled APIs ────────────────────────────────
  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const year = new Date().getFullYear();
      const res = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      });
      const data = await res.json();
      if (data.results) playSuccess();
      fetchAll();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Sync Single API ──────────────────────────────────────
  const handleSyncOne = async (apiId: string) => {
    setIsSyncing(true);
    try {
      const year = new Date().getFullYear();
      const res = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, apiId }),
      });
      const data = await res.json();
      if (data.results) playSuccess();
      fetchAll();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Bulk Delete by source ────────────────────────────────
  const handleBulkDelete = async (source: string) => {
    if (!confirm(`Delete all "${source}" holidays? This cannot be undone.`)) return;
    try {
      await fetch(`/api/calendar?bulkSource=${source}`, { method: "DELETE" });
      playNotify();
      fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  // ── Settings: Save helpers ───────────────────────────────
  const saveSetting = async (key: string, value: unknown): Promise<boolean> => {
    setSettingsSaving(key);
    setSettingsMsg(null);
    try {
      const res = await fetch("/api/calendar/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error("Save failed");
      playSuccess();
      setSettingsMsg({ type: "success", text: "Saved!" });
      setTimeout(() => setSettingsMsg(null), 2500);
      return true;
    } catch {
      setSettingsMsg({ type: "error", text: "Failed to save" });
      return false;
    } finally {
      setSettingsSaving(null);
    }
  };

  const currentCalendarExportLogo =
    calendarExportLogoPreview ?? (removeCalendarExportLogo ? null : calendarExportLogoData);

  const handleCalendarExportLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSettingsMsg({ type: "error", text: "Please select an image file" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSettingsMsg({ type: "error", text: "Logo must be under 2MB" });
      return;
    }

    setRemoveCalendarExportLogo(false);
    const reader = new FileReader();
    reader.onload = () => {
      setCalendarExportLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCalendarExportLogo = () => {
    setCalendarExportLogoPreview(null);
    setRemoveCalendarExportLogo(true);
    if (calendarLogoInputRef.current) {
      calendarLogoInputRef.current.value = "";
    }
  };

  const saveCalendarExportLogo = async () => {
    const valueToSave = removeCalendarExportLogo ? null : currentCalendarExportLogo;
    const ok = await saveSetting("calendar_export_logo", valueToSave);
    if (!ok) return;

    setCalendarExportLogoData(valueToSave);
    setCalendarExportLogoPreview(null);
    setRemoveCalendarExportLogo(false);
    if (calendarLogoInputRef.current) {
      calendarLogoInputRef.current.value = "";
    }
  };

  // ── Settings: API CRUD ───────────────────────────────────
  const openAddApi = () => {
    setEditingApi(null);
    setApiForm({ ...DEFAULT_API, id: `api-${Date.now()}` });
    setIsApiModalOpen(true);
    playClick();
  };

  const openEditApi = (api: ApiConfig) => {
    setEditingApi(api);
    setApiForm({ ...api });
    setIsApiModalOpen(true);
    playClick();
  };

  const saveApiConfig = async () => {
    if (!apiForm.name || !apiForm.endpoint) return;
    let updated: ApiConfig[];
    if (editingApi) {
      updated = apiConfigs.map((a) => (a.id === editingApi.id ? { ...apiForm } : a));
    } else {
      updated = [...apiConfigs, apiForm];
    }
    setApiConfigs(updated);
    setIsApiModalOpen(false);
    await saveSetting("holiday_api_configs", updated);
  };

  const deleteApiConfig = async (apiId: string) => {
    if (!confirm("Delete this API configuration?")) return;
    const updated = apiConfigs.filter((a) => a.id !== apiId);
    setApiConfigs(updated);
    await saveSetting("holiday_api_configs", updated);
  };

  const toggleApiEnabled = async (apiId: string) => {
    const updated = apiConfigs.map((a) =>
      a.id === apiId ? { ...a, enabled: !a.enabled } : a
    );
    setApiConfigs(updated);
    await saveSetting("holiday_api_configs", updated);
  };

  // ── Export: Send Calendar Email ──────────────────────────
  const sendCalendarEmail = async () => {
    if (!exportRecipients.trim()) return;
    setIsSendingExport(true);
    setExportMsg(null);
    try {
      const res = await fetch("/api/calendar/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          recipients: exportRecipients.split(/[\n,]+/).map((e) => e.trim()).filter(Boolean),
          month: exportMonth,
          year: exportYear,
          template: {
            subject: exportSubject,
            headerText: exportHeaderText,
            footerText: exportFooterText,
            layout: exportLayout,
            includeCompanyLogo: true,
          },
          holidays: exportHolidays.map((h) => ({
            title: h.title,
            date: h.date,
            category: h.category,
            color: categoryColors[h.category as keyof CategoryColors] || h.color || "#06427F",
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      playSuccess();
      setExportMsg({ type: "success", text: `Calendar sent to ${data.sentTo} recipient(s)!` });
      setTimeout(() => setExportMsg(null), 4000);
    } catch (err) {
      setExportMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to send" });
    } finally {
      setIsSendingExport(false);
    }
  };

  // ── Export: PDF download (client-side) ───────────────────
  const downloadPdf = async () => {
    setExportMsg(null);
    try {
      const jspdfModule = await import("jspdf");
      const JsPdfCtor = jspdfModule.jsPDF || (jspdfModule as unknown as { default?: typeof jspdfModule.jsPDF }).default;
      if (!JsPdfCtor) throw new Error("Unable to load jsPDF module");

      const pdf = new JsPdfCtor({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();  // ~297
      const pageH = pdf.internal.pageSize.getHeight(); // ~210

      /* ── Helpers ── */
      const hexToRgb = (hex: string): [number, number, number] => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b];
      };
      const lighten = (hex: string, amt: number): [number, number, number] => {
        const [r, g, b] = hexToRgb(hex);
        return [Math.min(255, r + amt), Math.min(255, g + amt), Math.min(255, b + amt)];
      };
      const setFill = (hex: string) => { const [r, g, b] = hexToRgb(hex); pdf.setFillColor(r, g, b); };
      const setFillRgb = (rgb: [number, number, number]) => { pdf.setFillColor(rgb[0], rgb[1], rgb[2]); };
      const setTextCol = (hex: string) => { const [r, g, b] = hexToRgb(hex); pdf.setTextColor(r, g, b); };
      const setDraw = (hex: string) => { const [r, g, b] = hexToRgb(hex); pdf.setDrawColor(r, g, b); };

      /* Rounded rect helper (jsPDF has roundedRect) */
      const roundRect = (x: number, y: number, w: number, h: number, r: number, style: "F" | "S" | "FD" = "F") => {
        pdf.roundedRect(x, y, w, h, r, r, style);
      };

      const margin = 8;
      const headerH = 26;
      const footerH = 8;
      const bodyTop = margin + headerH + 4;
      const bodyBottom = pageH - margin - footerH;
      const contentW = pageW - margin * 2;

      /* ── HEADER BANNER ── layered rects for gradient feel */
      setFill("#3c658d");
      roundRect(margin, margin, contentW, headerH, 3, "F");
      /* Lighter right section */
      setFill("#82b2e2");
      pdf.rect(margin + contentW * 0.35, margin, contentW * 0.65, headerH, "F");
      /* Lightest right edge */
      setFill("#95aac0");
      pdf.rect(margin + contentW * 0.65, margin, contentW * 0.35, headerH, "F");
      /* Re-draw rounded left edge to cover overlap */
      setFill("#06427F");
      roundRect(margin, margin, contentW * 0.38, headerH, 3, "F");

      /* Company logo centered in header, text stays left */
      if (currentCalendarExportLogo) {
        try {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Logo load failed"));
            img.src = currentCalendarExportLogo;
          });
          const natW = img.naturalWidth || img.width;
          const natH = img.naturalHeight || img.height;
          if (natW > 0 && natH > 0) {
            const aspect = natW / natH;
            const logoMaxH = headerH - 4;
            const logoH = logoMaxH;
            const logoW = logoH * aspect;
            const logoX = margin + (contentW - logoW) / 2;
            const logoY = margin + 2;
            const fmt = currentCalendarExportLogo.includes("image/png") ? "PNG" : "JPEG";
            pdf.addImage(currentCalendarExportLogo, fmt, logoX, logoY, logoW, logoH);
          }
        } catch {
          // logo failed, skip
        }
      }

      /* Month title — always left-aligned, large */
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      setTextCol("#ffffff");
      pdf.text(MONTH_NAMES[exportMonth], margin + 6, margin + 10);
      /* Year subtitle */
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      setTextCol("#c7ddf5");
      pdf.text(`${exportYear} Holiday Calendar`, margin + 6, margin + 16);

      /* Legend in header */
      const legendKeys = ["federal", "fun", "company"] as const;
      let legendX = pageW - margin - 6;
      pdf.setFontSize(7);
      for (let li = legendKeys.length - 1; li >= 0; li--) {
        const key = legendKeys[li];
        const labelText = categoryLabels[key] || key;
        const tw = pdf.getTextWidth(labelText);
        const dotR = 1.5;
        const gap = 1.5;
        const itemW = dotR * 2 + gap + tw;
        legendX -= itemW;
        const dotCy = margin + headerH / 2;
        const catColor = categoryColors[key] || "#06427F";
        /* White circle background for dot visibility */
        setFill("#ffffff");
        pdf.circle(legendX + dotR, dotCy, dotR + 0.3, "F");
        setFill(catColor);
        pdf.circle(legendX + dotR, dotCy, dotR, "F");
        setTextCol("#e8f0fa");
        pdf.text(labelText, legendX + dotR * 2 + gap, dotCy + 1);
        legendX -= 4; // spacing between items
      }

      /* ── Prepare day data ── */
      const byDay: Record<number, Holiday[]> = {};
      exportHolidays.forEach((h) => {
        const day = new Date(h.date + "T00:00:00").getDate();
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(h);
      });

      if (exportLayout === "list") {
        /* ── LIST LAYOUT ── */
        const sorted = exportHolidays.slice().sort((a, b) => a.date.localeCompare(b.date));
        if (sorted.length === 0) {
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(11);
          setTextCol("#9ca3af");
          pdf.text("No visible holidays for this month.", pageW / 2, bodyTop + 20, { align: "center" });
        } else {
          const colWidths = [contentW * 0.25, contentW * 0.5, contentW * 0.25];
          const rowH = 8;
          const tableX = margin;
          let y = bodyTop;

          /* Table header */
          setFill("#f1f5f9");
          roundRect(tableX, y, contentW, rowH + 1, 2, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7);
          setTextCol("#64748b");
          const headers = ["DATE", "HOLIDAY", "CATEGORY"];
          let hx = tableX + 4;
          headers.forEach((h, i) => {
            pdf.text(h, hx, y + rowH / 2 + 1);
            hx += colWidths[i];
          });
          y += rowH + 1;

          /* Separator line */
          setDraw("#e2e8f0");
          pdf.setLineWidth(0.4);
          pdf.line(tableX, y, tableX + contentW, y);
          y += 0.5;

          /* Rows */
          sorted.forEach((h, idx) => {
            const isEven = idx % 2 === 0;
            if (isEven) {
              setFill("#ffffff");
            } else {
              setFill("#f8fafc");
            }
            pdf.rect(tableX, y, contentW, rowH, "F");

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            setTextCol("#374151");
            const dateStr = new Date(h.date + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric",
            });
            pdf.text(dateStr, tableX + 4, y + rowH / 2 + 1);

            pdf.setFont("helvetica", "bold");
            setTextCol("#111827");
            pdf.text(h.title, tableX + 4 + colWidths[0], y + rowH / 2 + 1);

            /* Category pill */
            const catColor = categoryColors[h.category as keyof CategoryColors] || "#64748b";
            const catLabel = categoryLabels[h.category as keyof CategoryLabels] || h.category;
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(6.5);
            const pillW = pdf.getTextWidth(catLabel) + 5;
            const pillH = 4;
            const pillX = tableX + 4 + colWidths[0] + colWidths[1];
            const pillY = y + (rowH - pillH) / 2;
            setFillRgb(lighten(catColor, 190));
            roundRect(pillX, pillY, pillW, pillH, 1.5, "F");
            setTextCol(catColor);
            pdf.text(catLabel, pillX + 2.5, pillY + pillH / 2 + 1);

            /* Row divider */
            setDraw("#f1f5f9");
            pdf.setLineWidth(0.15);
            pdf.line(tableX, y + rowH, tableX + contentW, y + rowH);

            y += rowH;
          });
        }
      } else {
        /* ── GRID LAYOUT ── */
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const colW = contentW / 7;
        const dayHeaderH = 7;
        const firstDay = new Date(exportYear, exportMonth, 1);
        const lastDay = new Date(exportYear, exportMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();
        const totalCells = startingDay + daysInMonth;
        const numWeeks = Math.ceil(totalCells / 7);
        const availH = bodyBottom - bodyTop - dayHeaderH - 2;
        const cellH = Math.min(availH / numWeeks, 28);
        const maxEventsPerDay = Math.max(1, ...Object.values(byDay).map((arr) => arr.length));

        const gridX = margin;
        let gridY = bodyTop;

        /* Day-of-week header bar */
        setFill("#06427F");
        roundRect(gridX, gridY, contentW, dayHeaderH, 2, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        setTextCol("#ffffff");
        dayNames.forEach((d, i) => {
          pdf.text(d, gridX + colW * i + colW / 2, gridY + dayHeaderH / 2 + 1.5, { align: "center" });
        });
        gridY += dayHeaderH;

        /* Grid outline */
        setDraw("#e2e8f0");
        pdf.setLineWidth(0.2);

        let dayCounter = 1;
        for (let week = 0; week < numWeeks; week++) {
          for (let dow = 0; dow < 7; dow++) {
            const cx = gridX + dow * colW;
            const cy = gridY + week * cellH;
            const isEmpty = (week === 0 && dow < startingDay) || dayCounter > daysInMonth;

            /* Cell background */
            if (isEmpty) {
              setFill("#f8fafc");
            } else if (dow === 0 || dow === 6) {
              setFill("#fafbfc");
            } else {
              setFill("#ffffff");
            }
            pdf.rect(cx, cy, colW, cellH, "FD");

            if (isEmpty) continue;

            const d = dayCounter;

            /* Day number */
            pdf.setFontSize(8);
            const isWknd = dow === 0 || dow === 6;
            setTextCol(isWknd ? "#94a3b8" : "#374151");
            pdf.setFont("helvetica", "bold");
            pdf.text(String(d), cx + 2.5, cy + 4.5);

            /* Holiday chips */
            const holidays = byDay[d] || [];
            const usableChipH = Math.max(8, cellH - 8);
            const chipGap = 0.4;
            const perEventSpace = usableChipH / maxEventsPerDay;
            const chipH = Math.max(1.8, perEventSpace - chipGap);
            const chipFont = Math.max(3.1, Math.min(5.5, chipH * 0.95));
            const chipTop = cy + 7;
            const chipMargin = 1.5;

            holidays.forEach((h, hi) => {
              const chipY = chipTop + hi * (chipH + chipGap);
              const chipX = cx + chipMargin;
              const chipW = colW - chipMargin * 2;
              const eventColor = categoryColors[h.category as keyof CategoryColors] || h.color || "#06427F";
              setFill(eventColor);
              roundRect(chipX, chipY, chipW, chipH, 1.2, "F");

              /* Chip text — properly vertically centered */
              setTextCol("#ffffff");
              pdf.setFont("helvetica", "bold");
              pdf.setFontSize(chipFont);
              const maxTextW = chipW - 2;
              let title = h.title;
              while (pdf.getTextWidth(title) > maxTextW && title.length > 3) {
                title = title.slice(0, -1);
              }
              if (title !== h.title) title += "…";
              /* Vertical center: chipY + chipH/2 + fontSize*0.35 (baseline offset) */
              pdf.text(title, chipX + 1, chipY + chipH / 2 + 1);
            });

            dayCounter++;
          }
        }
      }

      /* ── FOOTER ── */
      const footerY = pageH - margin - footerH + 2;
      setDraw("#e2e8f0");
      pdf.setLineWidth(0.2);
      pdf.line(margin, footerY - 2, pageW - margin, footerY - 2);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6);
      setTextCol("#94a3b8");
      pdf.text(
        `Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
        margin + 2,
        footerY + 2
      );
      pdf.setFont("helvetica", "bold");
      pdf.text("ProConnect Holiday Calendar", pageW - margin - 2, footerY + 2, { align: "right" });

      pdf.save(`calendar-${MONTH_NAMES[exportMonth]}-${exportYear}.pdf`);
      playSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "PDF export failed";
      setExportMsg({ type: "error", text: `PDF export failed: ${message}` });
    }
  };

  // ── Helpers ──────────────────────────────────────────────
  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  // ── Calendar grid for export preview ─────────────────────
  function renderCalendarGrid() {
    const firstDay = new Date(exportYear, exportMonth, 1);
    const lastDay = new Date(exportYear, exportMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    const byDay: Record<number, Holiday[]> = {};
    exportHolidays.forEach((h) => {
      const day = new Date(h.date + "T00:00:00").getDate();
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(h);
    });
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === exportYear && today.getMonth() === exportMonth;
    const todayDate = today.getDate();
    const weeks: React.ReactNode[] = [];
    let currentDay = 1;
    let weekKey = 0;
    while (currentDay <= daysInMonth) {
      const cells: React.ReactNode[] = [];
      for (let i = 0; i < 7; i++) {
        if ((weeks.length === 0 && i < startingDay) || currentDay > daysInMonth) {
          cells.push(<td key={`e-${i}`} className="border border-gray-200/80 h-24 bg-slate-50/50" />);
        } else {
          const dayH = byDay[currentDay] || [];
          const d = currentDay;
          const isTodayCell = isCurrentMonth && d === todayDate;
          const isWeekend = i === 0 || i === 6;
          cells.push(
            <td key={d} className={`border border-gray-200/80 h-24 align-top p-0 w-[14.28%] ${isTodayCell ? "bg-blue-50/80" : isWeekend ? "bg-slate-50/30" : "bg-white"}`}>
              <div className="px-1.5 pt-1 pb-0.5 flex items-center">
                <span className={`text-xs font-bold leading-none ${isTodayCell ? "bg-brand-blue text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]" : isWeekend ? "text-gray-400" : "text-gray-700"}`}>{d}</span>
              </div>
              <div className="px-1 space-y-0.5">
                {dayH.map((h) => (
                  <div
                    key={h.id}
                    className="text-[9px] leading-tight text-white rounded px-1 py-0.5 truncate font-medium flex items-center gap-0.5 min-h-[16px]"
                    style={{ backgroundColor: categoryColors[h.category as keyof CategoryColors] || h.color || "#06427F" }}
                    title={h.title}
                  >
                    <span className="w-1 h-1 rounded-full bg-white/50 flex-shrink-0" />
                    <span className="truncate">{h.title}</span>
                  </div>
                ))}
              </div>
            </td>
          );
          currentDay++;
        }
      }
      weeks.push(<tr key={weekKey++}>{cells}</tr>);
    }
    return (
      <div className="rounded-xl overflow-hidden border border-gray-200/80 shadow-sm">
        <table className="w-full border-collapse table-fixed text-xs">
          <thead>
            <tr className="bg-brand-blue text-white">
              {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d) => (
                <th key={d} className="py-2.5 text-center font-semibold w-[14.28%] text-[11px] tracking-wide">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>{weeks}</tbody>
        </table>
      </div>
    );
  }

  /* ─────────────────────── RENDER ────────────────────────── */

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4 text-brand-grey" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-purple-500" />
              Calendar Management
            </h1>
            <p className="text-sm text-brand-grey mt-0.5">
              Holidays, API sources, export &amp; email settings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="gap-1.5"
          >
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Sync All
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5 bg-brand-blue hover:bg-brand-blue/90">
            <Plus className="w-3.5 h-3.5" />
            Add Holiday
          </Button>
        </div>
      </div>

      {/* ── Stats Row ───────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, icon: CalendarDays, color: "bg-purple-500" },
            { label: "Federal", value: stats.federal, icon: Flag, color: "bg-blue-500" },
            { label: "Fun", value: stats.fun, icon: PartyPopper, color: "bg-green-500" },
            { label: "Company", value: stats.company, icon: Building2, color: "bg-brand-blue" },
            { label: "Hidden", value: stats.hidden, icon: EyeOff, color: "bg-gray-400" },
          ].map((s) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3"
            >
              <div className={`w-9 h-9 ${s.color} rounded-lg flex items-center justify-center`}>
                <s.icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-brand-grey">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200">
        {([
          { key: "holidays" as TabKey, label: "Holidays", icon: CalendarDays },
          { key: "settings" as TabKey, label: "Settings", icon: Settings },
          { key: "export" as TabKey, label: "Export & Email", icon: Send },
          { key: "sync" as TabKey, label: "Sync History", icon: BarChart3 },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); playClick(); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === tab.key
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-brand-grey hover:text-gray-700"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ── HOLIDAYS TAB ────────────────────────────────────── */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === "holidays" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-grey" />
              <Input
                placeholder="Search holidays..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-brand-grey" />
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-brand-grey ml-auto">
              {filtered.length} holiday{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <Table className="table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal">
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-center">Visible</TableHead>
                  <TableHead className="text-center">Recurring</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <CalendarDays className="w-8 h-8 text-brand-grey/30 mx-auto mb-2" />
                        <p className="text-sm text-brand-grey">
                          {holidays.length === 0
                            ? 'No holidays yet. Click "Add Holiday" or "Sync All" to get started.'
                            : "No holidays match your filter."}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((h) => (
                      <motion.tr
                        key={h.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                          !h.visible ? "opacity-50" : ""
                        }`}
                      >
                        <TableCell>
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: h.color }} />
                        </TableCell>
                        <TableCell className="font-medium text-gray-900 break-words">{h.title}</TableCell>
                        <TableCell className="text-sm text-brand-grey">{formatDate(h.date)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-medium"
                            style={getCategoryBadgeStyle(categoryColors[h.category as keyof CategoryColors] || "#6b7280")}
                          >
                            {categoryLabels[h.category as keyof CategoryLabels] || h.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-brand-grey break-words">{h.source}</TableCell>
                        <TableCell className="text-center">
                          <button onClick={() => toggleVisibility(h)} className="p-1 hover:bg-gray-100 rounded transition-colors">
                            {h.visible ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          {h.recurring ? <RefreshCw className="w-3.5 h-3.5 text-brand-blue mx-auto" /> : <span className="text-xs text-brand-grey">—</span>}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(h)} className="h-7 w-7 p-0">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => confirmDelete(h)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>

          {/* Bulk Actions */}
          {holidays.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
              <span className="text-xs text-brand-grey font-medium">Bulk Delete:</span>
              {/* Per-source buttons */}
              {Array.from(new Set(holidays.map((h) => h.source))).filter((s) => s !== "custom").map((source) => (
                <Button key={source} variant="outline" size="sm" className="text-xs h-7" onClick={() => handleBulkDelete(source)}>
                  All &ldquo;{source}&rdquo;
                </Button>
              ))}
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleBulkDelete("custom")}>
                All Custom
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 text-red-500 border-red-200 hover:bg-red-50"
                onClick={() => {
                  if (confirm("Delete ALL holidays? This cannot be undone.")) {
                    fetch("/api/calendar?bulkAll=true", { method: "DELETE" }).then(() => {
                      playNotify();
                      fetchAll();
                    });
                  }
                }}
              >
                Delete All
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ── SETTINGS TAB ────────────────────────────────────── */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === "settings" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Status message */}
          {settingsMsg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              settingsMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}>
              {settingsMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {settingsMsg.text}
            </div>
          )}

          {/* ── Holiday API Sources ──────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-brand-blue" />
                <h3 className="font-semibold text-gray-900">Holiday API Sources</h3>
              </div>
              <Button size="sm" onClick={openAddApi} className="gap-1.5 bg-brand-blue hover:bg-brand-blue/90">
                <Plus className="w-3.5 h-3.5" />
                Add API
              </Button>
            </div>
            <p className="text-xs text-brand-grey mb-4">
              Configure external APIs to automatically sync holidays. Enable/disable or sync individual sources.
            </p>
            {apiConfigs.length === 0 ? (
              <p className="text-sm text-brand-grey text-center py-8">No API sources configured yet.</p>
            ) : (
              <div className="space-y-3">
                {apiConfigs.map((api) => (
                  <div
                    key={api.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                      api.enabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: api.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate">{api.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{API_TYPE_LABELS[api.type] || api.type}</Badge>
                        <Badge
                          variant="secondary"
                          className="text-[10px]"
                          style={getCategoryBadgeStyle(categoryColors[api.category as keyof CategoryColors] || "#6b7280")}
                        >
                          {categoryLabels[api.category as keyof CategoryLabels] || api.category}
                        </Badge>
                      </div>
                      <div className="text-xs text-brand-grey truncate mt-0.5">{api.endpoint}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title={api.enabled ? "Disable" : "Enable"}
                        onClick={() => toggleApiEnabled(api.id)}
                      >
                        {api.enabled ? <Power className="w-3.5 h-3.5 text-green-600" /> : <PowerOff className="w-3.5 h-3.5 text-gray-400" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Sync now"
                        disabled={isSyncing || !api.enabled}
                        onClick={() => handleSyncOne(api.id)}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditApi(api)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteApiConfig(api.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-red-500 border-red-200 hover:bg-red-50 ml-1"
                        onClick={() => handleBulkDelete(api.id)}
                        title="Delete all holidays from this source"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Holidays
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Category Labels ──────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-4 h-4 text-purple-500" />
              <h3 className="font-semibold text-gray-900">Category Labels</h3>
            </div>
            <p className="text-xs text-brand-grey mb-4">
              Customize the display names and colors for holiday categories.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(["federal", "fun", "company"] as const).map((key) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block capitalize flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: categoryColors[key] }} />
                    {key}
                  </label>
                  <Input
                    value={categoryLabels[key]}
                    onChange={(e) => setCategoryLabels({ ...categoryLabels, [key]: e.target.value })}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="color"
                      value={categoryColors[key]}
                      onChange={(e) => setCategoryColors({ ...categoryColors, [key]: e.target.value })}
                      className="w-9 h-9 rounded border border-gray-200 cursor-pointer"
                    />
                    <Input
                      value={categoryColors[key]}
                      onChange={(e) => setCategoryColors({ ...categoryColors, [key]: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                onClick={async () => {
                  await Promise.all([
                    saveSetting("category_labels", categoryLabels),
                    saveSetting("category_colors", categoryColors),
                  ]);
                }}
                disabled={settingsSaving === "category_labels" || settingsSaving === "category_colors"}
                className="gap-1.5 bg-brand-blue hover:bg-brand-blue/90"
              >
                {settingsSaving === "category_labels" || settingsSaving === "category_colors" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Labels & Colors
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-4 h-4 text-brand-blue" />
              <h3 className="font-semibold text-gray-900">Calendar Export Logo</h3>
            </div>
            <p className="text-xs text-brand-grey mb-4">
              Upload a custom logo for calendar PDF export and calendar email header. This logo is used instead of Site Branding.
            </p>

            <div className="space-y-3">
              <Input
                ref={calendarLogoInputRef}
                type="file"
                accept="image/*"
                onChange={handleCalendarExportLogoSelect}
                className="text-sm"
              />

              {currentCalendarExportLogo ? (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <img
                    src={currentCalendarExportLogo}
                    alt="Calendar export logo preview"
                    className="max-h-20 w-auto object-contain"
                  />
                </div>
              ) : (
                <div className="text-xs text-brand-grey">No custom export logo uploaded.</div>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveCalendarExportLogo}
                  disabled={!currentCalendarExportLogo || settingsSaving === "calendar_export_logo"}
                >
                  Remove
                </Button>
                <Button
                  size="sm"
                  onClick={saveCalendarExportLogo}
                  disabled={settingsSaving === "calendar_export_logo"}
                  className="gap-1.5 bg-brand-blue hover:bg-brand-blue/90"
                >
                  {settingsSaving === "calendar_export_logo" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Export Logo
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 text-blue-700 rounded-xl p-4 text-sm">
            SMTP settings are managed in Site Branding. Calendar export logo is managed here.
          </div>
        </motion.div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ── EXPORT & EMAIL TAB ──────────────────────────────── */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === "export" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Status message */}
          {exportMsg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              exportMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}>
              {exportMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {exportMsg.text}
            </div>
          )}

          {/* Month/Year Selector */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-purple-500" />
                <h3 className="font-semibold text-gray-900">Calendar Preview</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    if (exportMonth === 0) { setExportMonth(11); setExportYear(exportYear - 1); }
                    else setExportMonth(exportMonth - 1);
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium text-gray-900 min-w-[140px] text-center">
                  {MONTH_NAMES[exportMonth]} {exportYear}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    if (exportMonth === 11) { setExportMonth(0); setExportYear(exportYear + 1); }
                    else setExportMonth(exportMonth + 1);
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Preview Grid */}
            <div id="calendar-preview" className="bg-white">
              {renderCalendarGrid()}
              {exportHolidays.length === 0 && (
                <p className="text-center text-sm text-brand-grey py-6">No visible holidays for this month.</p>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 justify-center">
              {(["federal", "fun", "company"] as const).map((key) => (
                <span key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: categoryColors[key] }} />
                  {categoryLabels[key]}
                </span>
              ))}
            </div>

            {/* PDF Download */}
            <div className="mt-3 flex justify-end">
              <Button variant="outline" size="sm" onClick={downloadPdf} className="gap-1.5">
                <FileDown className="w-3.5 h-3.5" />
                Download PDF
              </Button>
            </div>
          </div>

          {/* ── Send via Email ───────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Send className="w-4 h-4 text-brand-blue" />
              <h3 className="font-semibold text-gray-900">Send Calendar via Email</h3>
            </div>
            <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-700 rounded-lg text-sm mb-4">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              SMTP is managed in Admin &rarr; Site Branding.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Recipients (one per line or comma-separated)</label>
                  <textarea
                    value={exportRecipients}
                    onChange={(e) => setExportRecipients(e.target.value)}
                    placeholder={"john@company.com\njane@company.com"}
                    rows={4}
                    className="w-full rounded-md border border-gray-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Subject</label>
                  <Input
                    value={exportSubject}
                    onChange={(e) => setExportSubject(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Header Text (optional)</label>
                  <Input
                    value={exportHeaderText}
                    onChange={(e) => setExportHeaderText(e.target.value)}
                    placeholder="Holiday calendar for your reference"
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Footer Text (optional)</label>
                  <Input
                    value={exportFooterText}
                    onChange={(e) => setExportFooterText(e.target.value)}
                    placeholder="Questions? Contact HR"
                    className="text-sm"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Layout</label>
                    <Select value={exportLayout} onValueChange={(v) => setExportLayout(v as "list" | "calendar")}>
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="calendar">Calendar Grid</SelectItem>
                        <SelectItem value="list">List View</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={sendCalendarEmail}
                disabled={isSendingExport || !exportRecipients.trim()}
                className="gap-1.5 bg-brand-blue hover:bg-brand-blue/90"
              >
                {isSendingExport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Calendar
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ── SYNC HISTORY TAB ────────────────────────────────── */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === "sync" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12">
                      <Clock className="w-8 h-8 text-brand-grey/30 mx-auto mb-2" />
                      <p className="text-sm text-brand-grey">No sync history yet.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  syncLogs.map((log) => (
                    <TableRow key={log.id} className="border-b border-gray-50">
                      <TableCell className="font-medium text-sm">{log.source}</TableCell>
                      <TableCell>
                        {log.status === "success" ? (
                          <Badge className="bg-green-100 text-green-700 text-[10px] gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Success
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 text-[10px] gap-1">
                            <XCircle className="w-3 h-3" /> Error
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-brand-grey max-w-xs truncate">
                        {log.message || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-brand-grey">
                        {new Date(log.syncedAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      )}

      {/* ── Create/Edit Holiday Modal ───────────────────────── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-purple-500" />
              {editingHoliday ? "Edit Holiday" : "Add Holiday"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Title</label>
              <Input
                placeholder="e.g. Independence Day"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    setFormData({ ...formData, category: v, color: categoryColors[v as keyof CategoryColors] || formData.color })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-9 h-9 rounded border border-gray-200 cursor-pointer"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.visible}
                  onChange={(e) => setFormData({ ...formData, visible: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
                />
                <span className="text-sm text-gray-700">Visible to employees</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.recurring}
                  onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
                />
                <span className="text-sm text-gray-700">Recurring yearly</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.title || !formData.date}
              className="bg-brand-blue hover:bg-brand-blue/90 gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingHoliday ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────── */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Holiday
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Are you sure you want to delete{" "}
            <strong>{deletingHoliday?.title}</strong> ({deletingHoliday?.date})?
            This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── API Config Modal ────────────────────────────────── */}
      <Dialog open={isApiModalOpen} onOpenChange={setIsApiModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-brand-blue" />
              {editingApi ? "Edit API Source" : "Add API Source"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Name</label>
                <Input
                  placeholder="e.g. Calendarific (US Fun)"
                  value={apiForm.name}
                  onChange={(e) => setApiForm({ ...apiForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
                <Select value={apiForm.type} onValueChange={(v) => setApiForm({ ...apiForm, type: v as ApiConfig["type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nager">Nager.Date</SelectItem>
                    <SelectItem value="calendarific">Calendarific</SelectItem>
                    <SelectItem value="abstract">Abstract API</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Country</label>
                <Input
                  placeholder="US"
                  value={apiForm.country}
                  onChange={(e) => setApiForm({ ...apiForm, country: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Endpoint URL</label>
                <Input
                  placeholder="https://date.nager.at/api/v3"
                  value={apiForm.endpoint}
                  onChange={(e) => setApiForm({ ...apiForm, endpoint: e.target.value })}
                />
              </div>
              {apiForm.type !== "nager" && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" /> API Key
                  </label>
                  <Input
                    type="password"
                    placeholder="Your API key"
                    value={apiForm.apiKey}
                    onChange={(e) => setApiForm({ ...apiForm, apiKey: e.target.value })}
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                <Select value={apiForm.category} onValueChange={(v) => setApiForm({ ...apiForm, category: v, color: categoryColors[v as keyof CategoryColors] || apiForm.color })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={apiForm.color}
                    onChange={(e) => setApiForm({ ...apiForm, color: e.target.value })}
                    className="w-9 h-9 rounded border border-gray-200 cursor-pointer"
                  />
                  <Input
                    value={apiForm.color}
                    onChange={(e) => setApiForm({ ...apiForm, color: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              {(apiForm.type === "calendarific") && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Type Filter (e.g. observance, national)</label>
                  <Input
                    placeholder="observance"
                    value={apiForm.typeFilter}
                    onChange={(e) => setApiForm({ ...apiForm, typeFilter: e.target.value })}
                  />
                </div>
              )}
              {apiForm.type === "custom" && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Date Field</label>
                    <Input
                      placeholder="date"
                      value={apiForm.dateField || ""}
                      onChange={(e) => setApiForm({ ...apiForm, dateField: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Title Field</label>
                    <Input
                      placeholder="name"
                      value={apiForm.titleField || ""}
                      onChange={(e) => setApiForm({ ...apiForm, titleField: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Response Path (dot-separated)</label>
                    <Input
                      placeholder="response.holidays"
                      value={apiForm.responsePathToHolidays || ""}
                      onChange={(e) => setApiForm({ ...apiForm, responsePathToHolidays: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={apiForm.enabled}
                    onChange={(e) => setApiForm({ ...apiForm, enabled: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
                  />
                  <span className="text-sm text-gray-700">Enabled (include in sync)</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApiModalOpen(false)}>Cancel</Button>
            <Button
              onClick={saveApiConfig}
              disabled={!apiForm.name || !apiForm.endpoint}
              className="bg-brand-blue hover:bg-brand-blue/90 gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {editingApi ? "Update" : "Add"} API
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
