import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import {
  ensureResourceFilesDir,
  getFileExtension,
  getResourceFilesDir,
  inferMimeTypeFromFileName,
  isAllowedDocument,
  loadResources,
  ResourceItem,
  saveResources,
} from "@/lib/resources-store";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_RESOURCES)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const file = formData.get("file");

    if (!title || !description || !category || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File is empty or exceeds 20MB" }, { status: 400 });
    }

    const mimeType = file.type || inferMimeTypeFromFileName(file.name);

    if (!isAllowedDocument(file.name, mimeType)) {
      return NextResponse.json(
        { error: "Only PDF, DOCX, XLSX, and CSV files are allowed" },
        { status: 400 }
      );
    }

    const resources = await loadResources();
    const id = `res-${randomUUID()}`;
    const extension = getFileExtension(file.name);
    const storageName = `${randomUUID()}.${extension}`;

    await ensureResourceFilesDir();
    const bytes = await file.arrayBuffer();
    await writeFile(join(getResourceFilesDir(), storageName), Buffer.from(bytes));

    const resource: ResourceItem = {
      id,
      title,
      description,
      href: `/resources/view/${id}`,
      category,
      sortOrder: resources.length,
      active: true,
      kind: "document",
      document: {
        storageName,
        originalName: file.name,
        mimeType,
        size: file.size,
      },
    };

    resources.push(resource);
    await saveResources(resources);

    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    console.error("[Resources Upload] POST error:", error);
    return NextResponse.json({ error: "Failed to upload resource document" }, { status: 500 });
  }
}
