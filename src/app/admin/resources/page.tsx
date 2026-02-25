"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileUp,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

interface ResourceItem {
  id: string;
  title: string;
  description: string;
  href: string;
  category: string;
  sortOrder: number;
  active: boolean;
  kind?: "link" | "document";
  document?: {
    originalName: string;
    mimeType: string;
    size: number;
  } | null;
}

export default function AdminResourcesPage() {
  const { playClick, playSuccess, playPop } = useSounds();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceItem | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formHref, setFormHref] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sortedResources = useMemo(
    () => [...resources].sort((a, b) => a.sortOrder - b.sortOrder),
    [resources]
  );

  const fetchResources = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/resources?all=true", { cache: "no-store" });
      const data = await response.json();
      setResources((data.resources || []) as ResourceItem[]);
    } catch {
      console.error("Failed to fetch resources");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormHref("");
    setFormCategory("");
    setEditingResource(null);
  };

  const resetUploadForm = () => {
    setUploadTitle("");
    setUploadDescription("");
    setUploadCategory("");
    setUploadFile(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
    playClick();
  };

  const openUpload = () => {
    resetUploadForm();
    setUploadDialogOpen(true);
    playClick();
  };

  const openEdit = (resource: ResourceItem) => {
    setEditingResource(resource);
    setFormTitle(resource.title);
    setFormDescription(resource.description);
    setFormHref(resource.href);
    setFormCategory(resource.category);
    setDialogOpen(true);
    playClick();
  };

  const handleSave = async () => {
    const isDocument = editingResource?.kind === "document";
    if (!formTitle.trim() || !formDescription.trim() || !formCategory.trim()) {
      return;
    }

    if (!isDocument && !formHref.trim()) return;

    setSaving(true);

    try {
      if (editingResource) {
        await fetch("/api/resources", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingResource.id,
            title: formTitle.trim(),
            description: formDescription.trim(),
            category: formCategory.trim(),
            ...(isDocument ? {} : { href: formHref.trim() }),
          }),
        });
      } else {
        await fetch("/api/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle.trim(),
            description: formDescription.trim(),
            href: formHref.trim(),
            category: formCategory.trim(),
          }),
        });
      }

      playSuccess();
      setDialogOpen(false);
      resetForm();
      fetchResources();
    } catch {
      console.error("Failed to save resource");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadTitle.trim() || !uploadDescription.trim() || !uploadCategory.trim() || !uploadFile) {
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", uploadTitle.trim());
      formData.append("description", uploadDescription.trim());
      formData.append("category", uploadCategory.trim());
      formData.append("file", uploadFile);

      await fetch("/api/resources/upload", {
        method: "POST",
        body: formData,
      });

      playSuccess();
      setUploadDialogOpen(false);
      resetUploadForm();
      fetchResources();
    } catch {
      console.error("Failed to upload resource document");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (resource: ResourceItem) => {
    playPop();
    await fetch("/api/resources", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: resource.id, active: !resource.active }),
    });
    fetchResources();
  };

  const handleDelete = async (id: string) => {
    playPop();
    await fetch(`/api/resources?id=${id}`, { method: "DELETE" });
    setDeletingId(null);
    fetchResources();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-6xl mx-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-brand-grey hover:text-brand-blue transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-brand-blue" />
              Resources
            </h1>
            <p className="text-sm text-brand-grey mt-0.5">
              Control what appears on the employee Resources page
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={openCreate} variant="outline" className="border-brand-blue/30 text-brand-blue hover:bg-brand-blue/5">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Link
          </Button>
          <Button onClick={openUpload} className="bg-brand-blue hover:bg-brand-blue/90 text-white">
            <FileUp className="w-4 h-4 mr-1.5" />
            Upload Document
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : sortedResources.length === 0 ? (
          <div className="py-16 text-center">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 text-brand-grey/30" />
            <p className="text-brand-grey text-sm">No resources yet</p>
            <Button onClick={openCreate} variant="outline" className="mt-4 text-sm">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Create your first resource
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-48 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedResources.map((resource) => (
                <TableRow key={resource.id} className={!resource.active ? "opacity-55" : ""}>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-gray-800">{resource.title}</p>
                      <p className="text-xs text-brand-grey max-w-md truncate">{resource.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {resource.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {resource.kind === "document" ? (
                      <div className="text-xs text-gray-700 max-w-[260px] truncate">
                        {resource.document?.originalName || "Document"}
                      </div>
                    ) : (
                      <a
                        href={resource.href}
                        target={resource.href.startsWith("http") ? "_blank" : undefined}
                        rel={resource.href.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="text-xs text-brand-blue hover:underline flex items-center gap-1 max-w-[260px] truncate"
                      >
                        {resource.href}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={resource.active ? "bg-green-100 text-green-700 text-[10px]" : "bg-gray-100 text-gray-500 text-[10px]"}>
                      {resource.active ? "Visible" : "Hidden"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleToggle(resource)}
                        title={resource.active ? "Hide resource" : "Show resource"}
                      >
                        {resource.active ? (
                          <EyeOff className="w-3.5 h-3.5 text-brand-grey" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-green-600" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(resource)}
                      >
                        <Pencil className="w-3.5 h-3.5 text-brand-blue" />
                      </Button>
                      {resource.kind === "document" ? (
                        <>
                          <a href={`/resources/view/${resource.id}`} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="View document">
                              <ExternalLink className="w-3.5 h-3.5 text-brand-blue" />
                            </Button>
                          </a>
                          <a href={`/api/resources/file/${resource.id}?download=true`}>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Download document">
                              <Download className="w-3.5 h-3.5 text-brand-grey" />
                            </Button>
                          </a>
                        </>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 hover:bg-red-50"
                        onClick={() => setDeletingId(resource.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingResource ? "Edit Resource" : "Add Link"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Title</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Employee Handbook"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Description</label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Company policies and guidelines"
              />
            </div>
            {editingResource?.kind !== "document" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">URL</label>
                <Input
                  value={formHref}
                  onChange={(e) => setFormHref(e.target.value)}
                  placeholder="https://example.com or /directory"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Category</label>
              <Input
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="HR & Policies"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 text-white">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingResource ? "Save Changes" : "Create Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) resetUploadForm();
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Title</label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Loan Process Guide"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Description</label>
              <Input
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Reference guide for processing"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Category</label>
              <Input
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                placeholder="Documents"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Document</label>
              <Input
                type="file"
                accept=".pdf,.docx,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              <p className="text-[11px] text-brand-grey">Accepted: PDF, DOCX, XLSX, CSV (max 20MB)</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 text-white">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete resource?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-brand-grey">
            This removes the resource from the Resources page.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
