"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText } from "lucide-react";

const HEADER_PX = 44; // slim header height in px
const MAX_VW = 0.92;
const MAX_VH = 0.92;

interface Props {
  open: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  holidayTitle?: string;
}

export function HolidayFlyerDialog({ open, onClose, fileUrl, fileName, mimeType, holidayTitle }: Props) {
  const isPdf = mimeType === "application/pdf" || fileUrl.toLowerCase().endsWith(".pdf");
  const isImage = mimeType.startsWith("image/");

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    const maxW = window.innerWidth * MAX_VW;
    const maxH = (window.innerHeight * MAX_VH) - HEADER_PX;
    const scale = Math.min(1, maxW / natW, maxH / natH);
    setImgSize({ w: Math.round(natW * scale), h: Math.round(natH * scale) });
  }, []);

  // Reset size when dialog closes so next open recalculates
  const handleOpenChange = (o: boolean) => {
    if (!o) { setImgSize(null); onClose(); }
  };

  const pdfSrc = isPdf ? `${fileUrl}#toolbar=0&navpanes=0&scrollbar=1&view=Fit` : fileUrl;

  // Dialog dimensions
  let dialogStyle: React.CSSProperties;
  if (isPdf) {
    dialogStyle = { width: "92vw", maxWidth: "92vw", height: "94vh", maxHeight: "94vh" };
  } else if (isImage && imgSize) {
    dialogStyle = {
      width: imgSize.w,
      maxWidth: `${MAX_VW * 100}vw`,
      height: imgSize.h + HEADER_PX,
      maxHeight: `${MAX_VH * 100}vh`,
    };
  } else {
    // Loading / fallback
    dialogStyle = { width: "auto", maxWidth: `${MAX_VW * 100}vw`, maxHeight: `${MAX_VH * 100}vh` };
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="p-0 overflow-hidden flex flex-col"
        style={dialogStyle}
      >
        <DialogHeader className="px-4 border-b border-gray-100 dark:border-gray-800 flex flex-row items-center gap-2 shrink-0" style={{ height: HEADER_PX }}>
          <FileText className="w-4 h-4 text-brand-blue shrink-0" />
          <DialogTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate flex-1 pr-8">
            {holidayTitle ?? fileName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-gray-100 dark:bg-gray-950">
          {isPdf && (
            <iframe
              src={pdfSrc}
              title={fileName}
              className="w-full h-full border-0"
            />
          )}
          {isImage && (
            <div className="flex items-center justify-center w-full h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileUrl}
                alt={fileName}
                onLoad={handleImageLoad}
                className="block max-w-full max-h-full object-contain rounded"
                style={imgSize ? { width: imgSize.w, height: imgSize.h } : undefined}
              />
            </div>
          )}
          {!isPdf && !isImage && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-brand-grey p-10">
              <FileText className="w-10 h-10 opacity-40" />
              <p className="text-sm">Preview not available.</p>
              <a href={fileUrl} download={fileName} className="text-sm text-brand-blue underline hover:opacity-80">
                Download file
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
