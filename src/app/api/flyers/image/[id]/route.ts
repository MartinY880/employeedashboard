// ProConnect — Serve Flyer Image
// GET: Stream a flyer image from uploads/flyers/

import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { getAuthUser } from "@/lib/logto";
import { UPLOADS_BASE } from "@/lib/uploads-dir";

const FLYERS_DIR = join(UPLOADS_BASE, "flyers");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAuthenticated } = await getAuthUser();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: filename } = await params;

    // Sanitize filename — prevent path traversal
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "");
    if (!safe || safe.includes("..")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filePath = join(FLYERS_DIR, safe);
    const info = await stat(filePath).catch(() => null);
    if (!info) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buffer = await readFile(filePath);
    const ext = safe.split(".").pop()?.toLowerCase() ?? "";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      pdf: "application/pdf",
    };

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeMap[ext] || "application/octet-stream",
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("[Flyer Image] GET error:", error);
    return NextResponse.json({ error: "Failed to serve image" }, { status: 500 });
  }
}
