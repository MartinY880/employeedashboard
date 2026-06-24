// ProConnect — Serve Training Video Thumbnail files
// GET /api/training-videos/upload-thumbnail/[filename]

import { readFile, stat } from "fs/promises";
import { join, extname } from "path";
import { NextResponse } from "next/server";
import { UPLOADS_BASE } from "@/lib/uploads-dir";

const THUMBS_DIR = join(UPLOADS_BASE, "training");

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "");
    const filePath = join(THUMBS_DIR, safe);

    const info = await stat(filePath);
    if (!info.isFile()) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = await readFile(filePath);
    const ext = extname(safe).toLowerCase();
    const contentType = MIME_MAP[ext] || "image/jpeg";

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
