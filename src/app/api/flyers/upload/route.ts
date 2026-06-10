// ProConnect — Flyer Upload API
// POST: Upload a flyer image or PDF (PDFs get a server-side PNG thumbnail via pdftoppm)

import { randomUUID } from "crypto";
import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS, toDbRole } from "@/lib/rbac";
import { ensureDbUser } from "@/lib/prisma";
import { createFlyer } from "@/lib/flyer-store";
import { UPLOADS_BASE } from "@/lib/uploads-dir";

const execFileAsync = promisify(execFile);

const FLYERS_DIR = join(UPLOADS_BASE, "flyers");
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
];

async function ensureFlyersDir() {
  await mkdir(FLYERS_DIR, { recursive: true });
}

function getExtension(filename: string, mimeType: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "gif", "webp", "svg", "pdf"].includes(ext)) return ext;
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("svg")) return "svg";
  if (mimeType.includes("pdf")) return "pdf";
  return "jpg";
}

async function generatePdfThumbnail(pdfPath: string, uuid: string): Promise<string | null> {
  const outputBase = join(FLYERS_DIR, `${uuid}-thumb`);
  try {
    await execFileAsync("pdftoppm", [
      "-png",
      "-r", "150",
      "-f", "1",
      "-l", "1",
      "-singlefile",
      pdfPath,
      outputBase,
    ]);
    // -singlefile writes outputBase.png (no page number suffix)
    const thumbPath = `${outputBase}.png`;
    // Verify it was created
    await readFile(thumbPath);
    return `${uuid}-thumb.png`;
  } catch {
    // Fallback: try without -singlefile (pdftoppm < 0.26 writes outputBase-1.png)
    try {
      await execFileAsync("pdftoppm", [
        "-png",
        "-r", "150",
        "-f", "1",
        "-l", "1",
        pdfPath,
        outputBase,
      ]);
      const thumbPath = `${outputBase}-1.png`;
      await readFile(thumbPath);
      // Rename to canonical name
      const { rename } = await import("fs/promises");
      await rename(thumbPath, `${outputBase}.png`);
      return `${uuid}-thumb.png`;
    } catch {
      return null;
    }
  }
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_FLYERS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const file = formData.get("image");
    const startDate = formData.get("startDate") ? String(formData.get("startDate")) : null;
    const endDate = formData.get("endDate") ? String(formData.get("endDate")) : null;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "A file is required" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    const mimeType = file.type || "image/jpeg";
    if (!ACCEPTED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported format. Accepted: JPEG, PNG, GIF, WebP, SVG, PDF" },
        { status: 400 }
      );
    }

    const dbUser = await ensureDbUser(
      user.sub,
      user.email ?? "",
      user.name ?? user.email ?? "Unknown",
      toDbRole(user.role)
    );

    const uuid = randomUUID();
    const ext = getExtension(file.name, mimeType);
    const storageName = `${uuid}.${ext}`;
    await ensureFlyersDir();

    const bytes = await file.arrayBuffer();
    const filePath = join(FLYERS_DIR, storageName);
    await writeFile(filePath, Buffer.from(bytes));

    let thumbnailFilename: string | null = null;
    if (mimeType === "application/pdf") {
      thumbnailFilename = await generatePdfThumbnail(filePath, uuid);
      if (!thumbnailFilename) {
        // Clean up the uploaded PDF if thumbnail generation failed
        await unlink(filePath).catch(() => {});
        return NextResponse.json(
          { error: "Failed to generate PDF thumbnail. Ensure the PDF is valid." },
          { status: 422 }
        );
      }
    }

    const flyer = await createFlyer({
      title,
      filename: storageName,
      thumbnailFilename,
      mimeType,
      fileSize: file.size,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      authorId: dbUser.id,
    });

    return NextResponse.json({ flyer }, { status: 201 });
  } catch (error) {
    console.error("[Flyer Upload] POST error:", error);
    return NextResponse.json({ error: "Failed to upload flyer" }, { status: 500 });
  }
}
