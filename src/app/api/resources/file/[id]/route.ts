import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { canInlineMimeType, getResourceFilesDir, loadResources } from "@/lib/resources-store";

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
    const resources = await loadResources();
    const resource = resources.find((entry) => entry.id === id);

    if (!resource || resource.kind !== "document" || !resource.document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const filePath = join(getResourceFilesDir(), resource.document.storageName);
    const fileBuffer = await readFile(filePath);

    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "true";
    const inline = !download && canInlineMimeType(resource.document.mimeType);
    const disposition = inline ? "inline" : "attachment";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": resource.document.mimeType,
        "Content-Length": String(fileBuffer.byteLength),
        "Content-Disposition": `${disposition}; filename="${resource.document.originalName}"`,
      },
    });
  } catch (error) {
    console.error("[Resources File] GET error:", error);
    return NextResponse.json({ error: "Failed to load file" }, { status: 500 });
  }
}
