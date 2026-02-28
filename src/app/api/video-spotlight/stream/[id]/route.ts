// ProConnect — Video Spotlight Streaming API
// GET: Serve video file with HTTP Range support for seeking

import { stat, open } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { getVideoSpotlightById } from "@/lib/video-spotlight-store";

const VIDEOS_DIR = join(process.cwd(), "uploads", "videos");

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { isAuthenticated } = await getAuthUser();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const video = await getVideoSpotlightById(id);
    if (!video || video.status !== "active") {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const filePath = join(VIDEOS_DIR, video.filename);

    let fileStats;
    try {
      fileStats = await stat(filePath);
    } catch {
      return NextResponse.json({ error: "Video file not found on disk" }, { status: 404 });
    }

    const fileSize = fileStats.size;
    const rangeHeader = request.headers.get("range");

    // Common headers
    const headers: Record<string, string> = {
      "Content-Type": video.mimeType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
    };

    // Range request (enables seeking in <video> players)
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (!match) {
        return new NextResponse("Invalid Range", {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        return new NextResponse("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      const chunkSize = end - start + 1;

      // Read the specific range from disk
      const fileHandle = await open(filePath, "r");
      const buffer = Buffer.alloc(chunkSize);
      await fileHandle.read(buffer, 0, chunkSize, start);
      await fileHandle.close();

      headers["Content-Range"] = `bytes ${start}-${end}/${fileSize}`;
      headers["Content-Length"] = String(chunkSize);

      return new NextResponse(buffer, { status: 206, headers });
    }

    // Full file response (no range)
    const fileHandle = await open(filePath, "r");
    const buffer = Buffer.alloc(fileSize);
    await fileHandle.read(buffer, 0, fileSize, 0);
    await fileHandle.close();

    headers["Content-Length"] = String(fileSize);

    return new NextResponse(buffer, { status: 200, headers });
  } catch (error) {
    console.error("[Video Spotlight Stream] GET error:", error);
    return NextResponse.json({ error: "Failed to stream video" }, { status: 500 });
  }
}
