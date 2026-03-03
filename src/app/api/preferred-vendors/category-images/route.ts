// ProConnect — Vendor Category Images API
// GET: Fetch category images map | POST: Upload/update a category image

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join, extname } from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

const LOGOS_DIR = join(process.cwd(), "uploads", "vendor-logos");
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml", "image/gif"];
const SETTINGS_ID = "vendor_category_images";

type CategoryImagesMap = Record<string, string>;

async function loadCategoryImages(): Promise<CategoryImagesMap> {
  try {
    const row = await prisma.calendarSetting.findUnique({ where: { id: SETTINGS_ID } });
    if (row?.data) {
      return JSON.parse(row.data) as CategoryImagesMap;
    }
  } catch {
    // ignore
  }
  return {};
}

async function saveCategoryImages(map: CategoryImagesMap) {
  await prisma.calendarSetting.upsert({
    where: { id: SETTINGS_ID },
    update: { data: JSON.stringify(map) },
    create: { id: SETTINGS_ID, data: JSON.stringify(map) },
  });
}

export async function GET() {
  try {
    const images = await loadCategoryImages();
    return NextResponse.json({ images });
  } catch (err) {
    console.error("[Category Images] GET error:", err);
    return NextResponse.json({ images: {} });
  }
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_VENDORS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const category = String(formData.get("category") ?? "").trim();
    const file = formData.get("file");
    const removeImage = formData.get("remove") === "true";
    const createOnly = formData.get("createOnly") === "true";

    if (!category) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }

    const images = await loadCategoryImages();

    if (removeImage) {
      delete images[category];
      await saveCategoryImages(images);
      return NextResponse.json({ images });
    }

    // Create a category entry without an image
    if (createOnly) {
      if (!(category in images)) {
        images[category] = "";
      }
      await saveCategoryImages(images);
      return NextResponse.json({ images });
    }

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 400 });
    }

    const mime = file.type || "";
    if (!ALLOWED_TYPES.includes(mime)) {
      return NextResponse.json({ error: "Only PNG, JPG, WebP, SVG, and GIF images are allowed" }, { status: 400 });
    }

    await mkdir(LOGOS_DIR, { recursive: true });

    const ext = extname(file.name) || ".png";
    const storageName = `cat-${randomUUID()}${ext}`;
    const bytes = await file.arrayBuffer();
    await writeFile(join(LOGOS_DIR, storageName), Buffer.from(bytes));

    const url = `/api/preferred-vendors/upload-logo/${storageName}`;
    images[category] = url;
    await saveCategoryImages(images);

    return NextResponse.json({ images, url });
  } catch (err) {
    console.error("[Category Images] POST error:", err);
    return NextResponse.json({ error: "Failed to update category image" }, { status: 500 });
  }
}

// DELETE: Remove a category entirely and reassign vendors to "Uncategorized"
export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_VENDORS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category")?.trim();

    if (!category) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }

    if (category === "Uncategorized") {
      return NextResponse.json({ error: "Cannot delete the Uncategorized category" }, { status: 400 });
    }

    // Reassign all vendors in this category to "Uncategorized"
    await prisma.preferredVendor.updateMany({
      where: { category },
      data: { category: "Uncategorized" },
    });

    // Remove the category image entry
    const images = await loadCategoryImages();
    delete images[category];

    // Ensure "Uncategorized" exists in the images map
    if (!("Uncategorized" in images)) {
      images["Uncategorized"] = "";
    }

    await saveCategoryImages(images);

    return NextResponse.json({ images, reassigned: true });
  } catch (err) {
    console.error("[Category Images] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
