"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ViewerPayload {
  mode: "pdf" | "docx" | "table";
  title: string;
  description: string;
  fileName: string;
  fileUrl?: string;
  html?: string;
  rows?: string[][];
  totalRows?: number;
  previewRows?: number;
  previewCols?: number;
  truncated?: boolean;
  downloadUrl: string;
}

export default function ResourceDocumentViewPage() {
  const params = useParams<{ id: string }>();
  const [payload, setPayload] = useState<ViewerPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchViewerData() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/resources/view/${params.id}`, { cache: "no-store" });
        if (!response.ok) {
          setError("Unable to load this document.");
          return;
        }
        const data = (await response.json()) as ViewerPayload;
        setPayload(data);
      } catch {
        setError("Unable to load this document.");
      } finally {
        setIsLoading(false);
      }
    }

    if (params.id) fetchViewerData();
  }, [params.id]);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/resources" className="text-brand-grey hover:text-brand-blue transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{payload?.title || "Document Viewer"}</h1>
            {payload?.description ? (
              <p className="text-sm text-brand-grey">{payload.description}</p>
            ) : null}
          </div>
        </div>

        {payload?.downloadUrl ? (
          <a href={payload.downloadUrl}>
            <Button className="bg-brand-blue hover:bg-brand-blue/90 text-white">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </a>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-[520px] w-full rounded-xl" />
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <FileText className="w-8 h-8 mx-auto text-brand-grey/40 mb-3" />
          <p className="text-sm text-brand-grey">{error}</p>
        </div>
      ) : null}

      {!isLoading && payload?.mode === "pdf" && payload.fileUrl ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <iframe title={payload.fileName} src={payload.fileUrl} className="w-full h-[75vh]" />
        </div>
      ) : null}

      {!isLoading && payload?.mode === "docx" ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <article
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: payload.html || "" }}
          />
        </div>
      ) : null}

      {!isLoading && payload?.mode === "table" ? (
        <div className="space-y-2">
          {payload.truncated ? (
            <div className="text-xs text-brand-grey bg-white border border-gray-200 rounded-lg px-3 py-2">
              Showing preview of first {payload.previewRows || 0} rows
              {payload.totalRows ? ` out of ${payload.totalRows.toLocaleString()}` : ""} and up to {payload.previewCols || 0} columns.
              Use Download for the full file.
            </div>
          ) : null}
          <div className="bg-white rounded-xl border border-gray-200 overflow-auto">
            <table className="min-w-full text-xs">
              <tbody>
                {(payload.rows || []).map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex === 0 ? "bg-gray-50" : ""}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${rowIndex}-${cellIndex}`}
                        className="px-3 py-2 border-b border-gray-100 whitespace-nowrap"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
