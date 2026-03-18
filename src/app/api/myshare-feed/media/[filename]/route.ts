// ProConnect — MyShare Media File Serving
// GET: Serve uploaded myshare images & videos (with Range support for Safari)

import { open, stat } from "fs/promises";
import { join, basename } from "path";
import { NextResponse } from "next/server";
import { UPLOADS_BASE } from "@/lib/uploads-dir";

const MYSHARE_DIR = join(UPLOADS_BASE, "highlight-media");

function getContentType(ext: string | undefined) {
  switch (ext) {
    case "webp": return "image/webp";
    case "png":  return "image/png";
    case "gif":  return "image/gif";
    case "mp4":  return "video/mp4";
    case "webm": return "video/webm";
    case "mov":  return "video/quicktime";
    default:     return "image/jpeg";
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;

    // Sanitize: strip path traversal, allow only simple filenames
    const safe = basename(filename);
    if (safe !== filename || filename.includes("..")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filePath = join(MYSHARE_DIR, safe);

    let fileInfo;
    try {
      fileInfo = await stat(filePath);
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ext = safe.split(".").pop()?.toLowerCase();
    const contentType = getContentType(ext);
    const totalSize = fileInfo.size;

    // Handle Range requests (required by Safari for video playback)
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
        const chunkSize = end - start + 1;

        const fh = await open(filePath, "r");
        const chunk = Buffer.alloc(chunkSize);
        await fh.read(chunk, 0, chunkSize, start);
        await fh.close();

        return new NextResponse(chunk, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Range": `bytes ${start}-${end}/${totalSize}`,
            "Content-Length": String(chunkSize),
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }

    // Full file response (images, or non-range video requests)
    const fh = await open(filePath, "r");
    const buffer = Buffer.alloc(totalSize);
    await fh.read(buffer, 0, totalSize, 0);
    await fh.close();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Length": String(totalSize),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[Highlight Media Serve]", err);
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}
