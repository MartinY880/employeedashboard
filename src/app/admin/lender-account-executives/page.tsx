"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  ImagePlus,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  Eye,
  EyeOff,
  Smartphone,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSounds } from "@/components/shared/SoundProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* ── Types ────────────────────────────────────────────────── */

interface Lender {
  id: string;
  name: string;
  logoUrl: string | null;
  active: boolean;
  sortOrder: number;
  _count?: { accountExecutives: number };
}

interface LenderAccountExecutive {
  id: string;
  lenderId: string;
  accountExecutiveName: string;
  workPhoneNumber: string;
  phoneExtension?: string | null;
  mobilePhoneNumber?: string | null;
  email: string;
  active: boolean;
  sortOrder: number;
  lender: { id: string; name: string; logoUrl: string | null; active: boolean };
}

const EMPTY_LENDER_FORM = { name: "" };
const EMPTY_AE_FORM = {
  lenderId: "",
  accountExecutiveName: "",
  workPhoneNumber: "",
  phoneExtension: "",
  mobilePhoneNumber: "",
  email: "",
  active: true,
};

export default function AdminLenderAccountExecutivesPage() {
  const { playClick } = useSounds();

  /* ── State ──────────────────────────────────────────────── */
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [records, setRecords] = useState<LenderAccountExecutive[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Lender form
  const [editLenderId, setEditLenderId] = useState<string | null>(null);
  const [lenderForm, setLenderForm] = useState({ ...EMPTY_LENDER_FORM });
  const [lenderLogo, setLenderLogo] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSavingLender, setIsSavingLender] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // AE form
  const [editAeId, setEditAeId] = useState<string | null>(null);
  const [aeForm, setAeForm] = useState({ ...EMPTY_AE_FORM });
  const [isSavingAe, setIsSavingAe] = useState(false);

  // Dashboard visibility
  const [showOnDashboard, setShowOnDashboard] = useState<boolean | null>(null);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  /* ── Fetching ──────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    try {
      const [lRes, aeRes] = await Promise.all([
        fetch("/api/lenders?all=true"),
        fetch("/api/lender-account-executives?all=true"),
      ]);
      const lData = await lRes.json();
      const aeData = await aeRes.json();
      setLenders(Array.isArray(lData.lenders) ? lData.lenders : []);
      setRecords(Array.isArray(aeData.records) ? aeData.records : []);
    } catch {
      setLenders([]);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    async function fetchVisibility() {
      try {
        const res = await fetch("/api/dashboard-settings/visibility");
        if (!res.ok) return;
        const data = await res.json();
        setShowOnDashboard(data.showLenderAccountExecutives !== false);
      } catch { /* keep null */ }
    }
    fetchVisibility();
  }, []);

  /* ── Dashboard visibility toggle ───────────────────────── */
  async function toggleVisibility() {
    if (showOnDashboard === null) return;
    const next = !showOnDashboard;
    playClick();
    setTogglingVisibility(true);
    try {
      const res = await fetch("/api/dashboard-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "showLenderAccountExecutives", value: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to update visibility");
      }
      setShowOnDashboard(next);
      toast.success(next ? "Lender AE dropdown shown on dashboard" : "Lender AE dropdown hidden from dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update visibility");
    } finally {
      setTogglingVisibility(false);
    }
  }

  /* ── Grouped data ──────────────────────────────────────── */
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filteredAes = records.filter((ae) => {
      if (!q) return true;
      return (
        ae.lender.name.toLowerCase().includes(q) ||
        ae.accountExecutiveName.toLowerCase().includes(q) ||
        (ae.workPhoneNumber || "").toLowerCase().includes(q) ||
        (ae.mobilePhoneNumber || "").toLowerCase().includes(q) ||
        (ae.phoneExtension || "").toLowerCase().includes(q) ||
        ae.email.toLowerCase().includes(q)
      );
    });

    // Build lender-grouped structure
    const map = new Map<string, { lender: Lender; aes: LenderAccountExecutive[] }>();

    // Start with all lenders (so empty lenders show up when not searching)
    for (const lender of lenders) {
      if (q && !lender.name.toLowerCase().includes(q) && !filteredAes.some((ae) => ae.lenderId === lender.id)) {
        continue;
      }
      map.set(lender.id, { lender, aes: [] });
    }

    for (const ae of filteredAes) {
      const entry = map.get(ae.lenderId);
      if (entry) {
        entry.aes.push(ae);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.lender.name.localeCompare(b.lender.name));
  }, [lenders, records, search]);

  /* ── Logo upload ───────────────────────────────────────── */
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/lenders/upload-logo", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : "Upload failed");
      }
      const data = await res.json();
      setLenderLogo(data.url);
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  /* ── Lender CRUD ───────────────────────────────────────── */
  function resetLenderForm() {
    setEditLenderId(null);
    setLenderForm({ ...EMPTY_LENDER_FORM });
    setLenderLogo(null);
  }

  function openEditLender(lender: Lender) {
    playClick();
    setEditLenderId(lender.id);
    setLenderForm({ name: lender.name });
    setLenderLogo(lender.logoUrl);
  }

  async function handleSaveLender() {
    if (!lenderForm.name.trim()) {
      toast.error("Lender name is required");
      return;
    }
    playClick();
    setIsSavingLender(true);
    try {
      const payload = editLenderId
        ? { id: editLenderId, name: lenderForm.name.trim(), logoUrl: lenderLogo }
        : { name: lenderForm.name.trim(), logoUrl: lenderLogo };

      const res = await fetch("/api/lenders", {
        method: editLenderId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to save lender");
      }
      toast.success(editLenderId ? "Lender updated" : "Lender created");
      resetLenderForm();
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save lender");
    } finally {
      setIsSavingLender(false);
    }
  }

  async function handleDeleteLender(id: string) {
    playClick();
    try {
      const res = await fetch(`/api/lenders?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to delete lender");
      }
      toast.success("Lender deleted");
      if (editLenderId === id) resetLenderForm();
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete lender");
    }
  }

  /* ── AE CRUD ───────────────────────────────────────────── */
  function resetAeForm() {
    setEditAeId(null);
    setAeForm({ ...EMPTY_AE_FORM });
  }

  function startAddAe(lenderId: string) {
    playClick();
    setEditAeId(null);
    setAeForm({ ...EMPTY_AE_FORM, lenderId });
  }

  function openEditAe(ae: LenderAccountExecutive) {
    playClick();
    setEditAeId(ae.id);
    setAeForm({
      lenderId: ae.lenderId,
      accountExecutiveName: ae.accountExecutiveName,
      workPhoneNumber: ae.workPhoneNumber || "",
      phoneExtension: ae.phoneExtension || "",
      mobilePhoneNumber: ae.mobilePhoneNumber || "",
      email: ae.email,
      active: ae.active,
    });
  }

  async function handleSaveAe() {
    if (!aeForm.lenderId || !aeForm.accountExecutiveName.trim()) {
      toast.error("Lender and name are required");
      return;
    }
    playClick();
    setIsSavingAe(true);
    try {
      const payload = {
        ...(editAeId ? { id: editAeId } : {}),
        lenderId: aeForm.lenderId,
        accountExecutiveName: aeForm.accountExecutiveName.trim(),
        workPhoneNumber: aeForm.workPhoneNumber.trim(),
        phoneExtension: aeForm.phoneExtension.trim(),
        mobilePhoneNumber: aeForm.mobilePhoneNumber.trim(),
        email: aeForm.email.trim(),
        active: aeForm.active,
      };
      const res = await fetch("/api/lender-account-executives", {
        method: editAeId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to save AE");
      }
      toast.success(editAeId ? "AE updated" : "AE created");
      resetAeForm();
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save AE");
    } finally {
      setIsSavingAe(false);
    }
  }

  async function handleToggleActive(item: LenderAccountExecutive) {
    playClick();
    try {
      const res = await fetch("/api/lender-account-executives", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, active: !item.active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to toggle active state");
      }
      setRecords((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, active: !r.active } : r))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle active state");
    }
  }

  async function handleDeleteAe(id: string) {
    playClick();
    try {
      const res = await fetch(`/api/lender-account-executives?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to delete entry");
      }
      toast.success("Entry deleted");
      setRecords((prev) => prev.filter((r) => r.id !== id));
      if (editAeId === id) resetAeForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete entry");
    }
  }

  /* ── Render ────────────────────────────────────────────── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1100px] mx-auto px-6 py-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-600" />
              Account Executive Contacts
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage lenders with logos and their account executives</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={toggleVisibility}
          disabled={showOnDashboard === null || togglingVisibility}
          className="gap-2"
        >
          {showOnDashboard === null || togglingVisibility ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : showOnDashboard ? (
            <Eye className="w-4 h-4 text-green-600" />
          ) : (
            <EyeOff className="w-4 h-4 text-gray-500" />
          )}
          {showOnDashboard ? "Visible on Dashboard" : "Hidden from Dashboard"}
        </Button>
      </div>

      {/* ── Forms Section ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Add / Edit Lender */}
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-blue" />
            {editLenderId ? "Edit Lender" : "Add Lender"}
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Lender Name</label>
              <Input
                value={lenderForm.name}
                onChange={(e) => setLenderForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Enter lender name"
                className="mt-1"
              />
            </div>

            {/* Logo upload */}
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Logo</label>
              <div className="mt-1 flex items-center gap-3">
                {lenderLogo ? (
                  <div className="relative h-14 w-14 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={lenderLogo} alt="Lender logo" className="h-full w-full object-contain" />
                    <button
                      onClick={() => setLenderLogo(null)}
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                      title="Remove logo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-14 w-14 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400">
                    <ImagePlus className="w-5 h-5" />
                  </div>
                )}

                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploadingLogo}
                >
                  {isUploadingLogo ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading</>
                  ) : (
                    <><Upload className="w-3.5 h-3.5 mr-1.5" /> {lenderLogo ? "Change" : "Upload"}</>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button onClick={handleSaveLender} disabled={isSavingLender}>
                {isSavingLender ? (
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving</>
                ) : (
                  <><Plus className="w-4 h-4 mr-1.5" /> {editLenderId ? "Update Lender" : "Add Lender"}</>
                )}
              </Button>
              {editLenderId && (
                <Button variant="outline" onClick={resetLenderForm}>Cancel</Button>
              )}
            </div>
          </div>
        </section>

        {/* Add / Edit Account Executive */}
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-600" />
            {editAeId ? "Edit Account Executive" : "Add Account Executive"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Lender</label>
              <select
                value={aeForm.lenderId}
                onChange={(e) => setAeForm((p) => ({ ...p, lenderId: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Select a lender…</option>
                {lenders.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">AE Name</label>
              <Input
                value={aeForm.accountExecutiveName}
                onChange={(e) => setAeForm((p) => ({ ...p, accountExecutiveName: e.target.value }))}
                placeholder="Enter AE name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Work Phone Number</label>
              <Input
                value={aeForm.workPhoneNumber}
                onChange={(e) => setAeForm((p) => ({ ...p, workPhoneNumber: e.target.value }))}
                placeholder="Enter work phone"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Extension (optional)</label>
              <Input
                value={aeForm.phoneExtension}
                onChange={(e) => setAeForm((p) => ({ ...p, phoneExtension: e.target.value }))}
                placeholder="e.g. 1234"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Mobile Phone Number</label>
              <Input
                value={aeForm.mobilePhoneNumber}
                onChange={(e) => setAeForm((p) => ({ ...p, mobilePhoneNumber: e.target.value }))}
                placeholder="Enter mobile phone"
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Email</label>
              <Input
                type="email"
                value={aeForm.email}
                onChange={(e) => setAeForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="Enter email"
                className="mt-1"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button onClick={handleSaveAe} disabled={isSavingAe}>
              {isSavingAe ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving</>
              ) : (
                <><Plus className="w-4 h-4 mr-1.5" /> {editAeId ? "Update AE" : "Add AE"}</>
              )}
            </Button>
            {editAeId && (
              <Button variant="outline" onClick={resetAeForm}>Cancel</Button>
            )}
          </div>
        </section>
      </div>

      {/* ── List Section ───────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Lenders &amp; Account Executives</h2>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lender, AE, work/mobile phone, email"
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 flex items-center justify-center text-brand-grey text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading records…
          </div>
        ) : grouped.length === 0 ? (
          <div className="py-10 text-center text-brand-grey text-sm">
            No matching entries found.
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(({ lender, aes }) => (
              <div key={lender.id} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Lender header */}
                <div className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
                  {lender.logoUrl ? (
                    <div className="h-8 w-8 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 flex-shrink-0 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={lender.logoUrl} alt={lender.name} className="h-full w-full object-contain" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-brand-blue" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{lender.name}</span>
                    {!lender.active && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500">Inactive</span>
                    )}
                  </div>
                  <span className="text-xs text-brand-grey shrink-0">{aes.length} AE{aes.length === 1 ? "" : "s"}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startAddAe(lender.id)}
                      className="h-7 w-7 rounded-md border border-cyan-200 text-cyan-600 hover:bg-cyan-50 dark:border-cyan-800 dark:hover:bg-cyan-900/30 flex items-center justify-center"
                      title="Add AE to this lender"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditLender(lender)}
                      className="h-7 w-7 rounded-md border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
                      title="Edit lender"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteLender(lender.id)}
                      className="h-7 w-7 rounded-md border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/30 flex items-center justify-center"
                      title="Delete lender"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* AE list */}
                {aes.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-brand-grey">
                    No account executives yet.{" "}
                    <button onClick={() => startAddAe(lender.id)} className="text-cyan-600 hover:underline">
                      Add one
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {aes.map((ae) => (
                      <div key={ae.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{ae.accountExecutiveName}</p>
                          <div className="mt-1 text-xs text-brand-grey space-y-1">
                            {ae.workPhoneNumber ? (
                              <p className="flex items-center gap-1.5">
                                <Phone className="w-3 h-3" />
                                {ae.workPhoneNumber}
                                {ae.phoneExtension ? <span className="text-[10px] text-gray-500">Ext. {ae.phoneExtension}</span> : null}
                              </p>
                            ) : null}
                            {ae.mobilePhoneNumber ? (
                              <p className="flex items-center gap-1.5">
                                <Smartphone className="w-3 h-3" />
                                {ae.mobilePhoneNumber}
                              </p>
                            ) : null}
                            {ae.email ? (
                              <p className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3" /> {ae.email}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleToggleActive(ae)}
                            className={`h-8 w-8 rounded-md border flex items-center justify-center transition-colors ${
                              ae.active
                                ? "border-green-200 text-green-600 hover:bg-green-50"
                                : "border-gray-200 text-gray-400 hover:bg-gray-50"
                            }`}
                            title={ae.active ? "Deactivate" : "Activate"}
                          >
                            {ae.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => openEditAe(ae)}
                            className="h-8 w-8 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAe(ae.id)}
                            className="h-8 w-8 rounded-md border border-red-200 text-red-500 hover:bg-red-50 flex items-center justify-center"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}
