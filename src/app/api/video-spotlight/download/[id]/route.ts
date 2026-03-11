// ProConnect — Video Spotlight Download API
// GET: Serve video file as a downloadable MP4 (H.264 + AAC).
// If the source uses Opus audio, ffmpeg transcodes to AAC and caches the result.

import { stat, open, mkdir, access } from "fs/promises";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { getVideoSpotlightById } from "@/lib/video-spotlight-store";
import { UPLOADS_BASE } from "@/lib/uploads-dir";

const execFileAsync = promisify(execFile);
const VIDEOS_DIR = join(UPLOADS_BASE, "videos");
const CACHE_DIR = join(UPLOADS_BASE, "videos", ".dl-cache");

interface Params {
  params: Promise<{ id: string }>;
}

/** Check whether a file has Opus audio via ffprobe */
async function hasOpusAudio(filePath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=codec_name",
      "-of", "csv=p=0",
      filePath,
    ]);
    return stdout.trim().toLowerCase() === "opus";
  } catch {
    return false;
  }
}

/** Convert video to MP4 with AAC audio, caching the result */
async function ensureCompatible(srcPath: string, videoId: string): Promise<string> {
  // If source doesn't have Opus audio, serve as-is
  if (!(await hasOpusAudio(srcPath))) return srcPath;

  // Check for cached conversion
  await mkdir(CACHE_DIR, { recursive: true });
  const cachedPath = join(CACHE_DIR, `${videoId}.mp4`);

  try {
    await access(cachedPath);
    // Cached file already exists
    return cachedPath;
  } catch {
    // Need to transcode
  }

  // Transcode: copy video stream, re-encode audio to AAC
  await execFileAsync("ffmpeg", [
    "-y",
    "-i", srcPath,
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    cachedPath,
  ], { timeout: 120_000 });

  return cachedPath;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { isAuthenticated } = await getAuthUser();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const video = await getVideoSpotlightById(id);
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const srcPath = join(VIDEOS_DIR, video.filename);

    try {
      await stat(srcPath);
    } catch {
      return NextResponse.json({ error: "Video file not found on disk" }, { status: 404 });
    }

    // Get a compatible MP4 (transcodes Opus→AAC if needed, cached)
    const servePath = await ensureCompatible(srcPath, id);
    const fileStats = await stat(servePath);

    // Determine a safe download filename
    const safeName = video.title
      .replace(/[^a-zA-Z0-9_\- ]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 100);
    const downloadName = `${safeName}.mp4`;

    const fileHandle = await open(servePath, "r");
    const buffer = Buffer.alloc(fileStats.size);
    await fileHandle.read(buffer, 0, fileStats.size, 0);
    await fileHandle.close();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(fileStats.size),
        "Content-Disposition": `attachment; filename="${downloadName}"`,
      },
    });
  } catch (error) {
    console.error("[Video Spotlight Download] GET error:", error);
    return NextResponse.json({ error: "Failed to download video" }, { status: 500 });
  }
}
