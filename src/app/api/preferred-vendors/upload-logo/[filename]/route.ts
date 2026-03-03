// ProConnect — Serve Vendor Logo files
// GET /api/preferred-vendors/upload-logo/[filename]

import { readFile, stat } from "fs/promises";
import { join, extname } from "path";
import { NextResponse } from "next/server";

const LOGOS_DIR = join(process.cwd(), "uploads", "vendor-logos");

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    // Sanitize
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "");
    const filePath = join(LOGOS_DIR, safe);

    const info = await stat(filePath);
    if (!info.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = await readFile(filePath);
    const ext = extname(safe).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

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
