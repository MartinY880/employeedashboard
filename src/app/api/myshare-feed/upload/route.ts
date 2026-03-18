// ProConnect — MyShare Media Upload API
// POST: Upload images for myshare posts (auto-optimized via sharp)

import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { mkdir, writeFile, unlink, stat } from "fs/promises";
import { join } from "path";
import { promisify } from "util";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { getAuthUser } from "@/lib/logto";
import { UPLOADS_BASE } from "@/lib/uploads-dir";

const execFileAsync = promisify(execFile);

const MYSHARE_DIR = join(UPLOADS_BASE, "highlight-media");
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB per image
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB per video
const MAX_FILES = 10;
const MAX_WIDTH = 1200;
const QUALITY = 80;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files");

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} files per upload` },
        { status: 400 },
      );
    }

    await mkdir(MYSHARE_DIR, { recursive: true });

    const uploaded: { fileUrl: string; mimeType: string; fileSize: number }[] = [];

    for (const file of files) {
      if (!(file instanceof File) || file.size <= 0) continue;

      const mime = file.type || "";
      const isImage = ALLOWED_IMAGE_TYPES.includes(mime);
      const isVideo = ALLOWED_VIDEO_TYPES.includes(mime);
      if (!isImage && !isVideo) continue;
      if (isImage && file.size > MAX_IMAGE_SIZE) continue;
      if (isVideo && file.size > MAX_VIDEO_SIZE) continue;

      const bytes = Buffer.from(await file.arrayBuffer());

      if (isVideo) {
        const storageName = `${randomUUID()}.mp4`;
        const outPath = join(MYSHARE_DIR, storageName);

        if (mime === "video/mp4") {
          // MP4 can be stored directly
          await writeFile(outPath, bytes);
        } else {
          // Transcode .mov / .webm → .mp4 via ffmpeg
          const tmpName = `${randomUUID()}_tmp.${mime === "video/webm" ? "webm" : "mov"}`;
          const tmpPath = join(MYSHARE_DIR, tmpName);
          await writeFile(tmpPath, bytes);
          try {
            await execFileAsync("ffmpeg", [
              "-i", tmpPath,
              "-c:v", "libx264",
              "-preset", "fast",
              "-crf", "23",
              "-c:a", "aac",
              "-movflags", "+faststart",
              "-y",
              outPath,
            ], { timeout: 120_000 });
          } finally {
            await unlink(tmpPath).catch(() => {});
          }
        }

        const info = await stat(outPath);
        uploaded.push({
          fileUrl: `/api/myshare-feed/media/${storageName}`,
          mimeType: "video/mp4",
          fileSize: info.size,
        });
      } else {
        // Process image through sharp
        const processed = await sharp(bytes)
          .rotate()
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .webp({ quality: QUALITY })
          .toBuffer();

        const storageName = `${randomUUID()}.webp`;
        await writeFile(join(MYSHARE_DIR, storageName), processed);
        uploaded.push({
          fileUrl: `/api/myshare-feed/media/${storageName}`,
          mimeType: "image/webp",
          fileSize: processed.length,
        });
      }
    }

    if (uploaded.length === 0) {
      return NextResponse.json({ error: "No valid files uploaded" }, { status: 400 });
    }

    return NextResponse.json({ media: uploaded }, { status: 201 });
  } catch (err) {
    console.error("[MyShare Upload]", err);
    return NextResponse.json({ error: "Failed to upload" }, { status: 500 });
  }
}
