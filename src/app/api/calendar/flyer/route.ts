// ProConnect — Holiday Flyer Upload API
// POST: Upload a flyer (PDF/image) for a HolidayEvent, returns { url, flyer }
// DELETE: Remove a flyer by eventId

import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import { join, extname } from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UPLOADS_BASE } from "@/lib/uploads-dir";

const FLYER_DIR = join(UPLOADS_BASE, "holiday-flyers");
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const eventId = formData.get("eventId");

    if (typeof eventId !== "string" || !eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds 20 MB limit" }, { status: 400 });
    }

    const mime = file.type || "";
    if (!ALLOWED_TYPES.includes(mime)) {
      return NextResponse.json({ error: "Only PDF, PNG, JPG, and WebP files are allowed" }, { status: 400 });
    }

    // Delete existing flyer file if one exists
    const existing = await prisma.holidayFlyer.findUnique({ where: { eventId } });
    if (existing) {
      const oldFilename = existing.fileUrl.split("/").pop();
      if (oldFilename) {
        try { await unlink(join(FLYER_DIR, oldFilename)); } catch { /* ignore */ }
      }
    }

    await mkdir(FLYER_DIR, { recursive: true });

    const ext = extname(file.name) || (mime === "application/pdf" ? ".pdf" : ".png");
    const storageName = `${randomUUID()}${ext}`;
    const bytes = await file.arrayBuffer();
    await writeFile(join(FLYER_DIR, storageName), Buffer.from(bytes));

    const fileUrl = `/api/calendar/flyer/${storageName}`;

    const flyer = await prisma.holidayFlyer.upsert({
      where: { eventId },
      update: {
        fileUrl,
        fileName: file.name,
        mimeType: mime,
        fileSize: file.size,
      },
      create: {
        eventId,
        fileUrl,
        fileName: file.name,
        mimeType: mime,
        fileSize: file.size,
      },
    });

    return NextResponse.json({ url: fileUrl, flyer }, { status: 201 });
  } catch (err) {
    console.error("[Holiday Flyer] POST error:", err);
    return NextResponse.json({ error: "Failed to upload flyer" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    const flyer = await prisma.holidayFlyer.findUnique({ where: { eventId } });
    if (!flyer) {
      return NextResponse.json({ message: "No flyer found" });
    }

    const filename = flyer.fileUrl.split("/").pop();
    if (filename) {
      try { await unlink(join(FLYER_DIR, filename)); } catch { /* ignore */ }
    }

    await prisma.holidayFlyer.delete({ where: { eventId } });

    return NextResponse.json({ message: "Flyer deleted" });
  } catch (err) {
    console.error("[Holiday Flyer] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete flyer" }, { status: 500 });
  }
}
