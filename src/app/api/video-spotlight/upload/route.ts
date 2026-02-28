// ProConnect — Video Spotlight Upload API
// POST: Upload a recorded or file-based video

import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { ensureDbUser } from "@/lib/prisma";
import { toDbRole } from "@/lib/rbac";
import { createVideoSpotlight } from "@/lib/video-spotlight-store";
import {
  MAX_VIDEO_FILE_SIZE,
  ACCEPTED_VIDEO_TYPES,
} from "@/lib/video-spotlight";

const VIDEOS_DIR = join(process.cwd(), "uploads", "videos");

async function ensureVideosDir() {
  await mkdir(VIDEOS_DIR, { recursive: true });
}

function getExtension(filename: string, mimeType: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && ["webm", "mp4", "mov", "avi", "mkv"].includes(ext)) return ext;
  // fallback from mime
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("x-msvideo")) return "avi";
  if (mimeType.includes("x-matroska")) return "mkv";
  return "webm";
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const file = formData.get("video");

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "A video file is required" }, { status: 400 });
    }

    if (file.size > MAX_VIDEO_FILE_SIZE) {
      return NextResponse.json(
        { error: `File exceeds maximum size of ${MAX_VIDEO_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    const mimeType = file.type || "video/webm";
    const isValid = ACCEPTED_VIDEO_TYPES.some((t) => mimeType.startsWith(t.split(";")[0]));
    if (!isValid) {
      return NextResponse.json(
        { error: "Unsupported video format. Accepted: WebM, MP4, MOV, AVI, MKV" },
        { status: 400 }
      );
    }

    // Ensure DB user exists
    const dbUser = await ensureDbUser(
      user.sub,
      user.email ?? "",
      user.name ?? user.email ?? "Unknown",
      toDbRole(user.role)
    );

    // Save file to disk
    const ext = getExtension(file.name, mimeType);
    const storageName = `${randomUUID()}.${ext}`;
    await ensureVideosDir();
    const bytes = await file.arrayBuffer();
    await writeFile(join(VIDEOS_DIR, storageName), Buffer.from(bytes));

    // Create DB record
    const video = await createVideoSpotlight({
      title,
      description,
      filename: storageName,
      mimeType,
      fileSize: file.size,
      duration: null, // set later via admin or client-side metadata extraction
      authorId: dbUser.id,
      authorName: dbUser.displayName,
    });

    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    console.error("[Video Spotlight Upload] POST error:", error);
    return NextResponse.json({ error: "Failed to upload video" }, { status: 500 });
  }
}
