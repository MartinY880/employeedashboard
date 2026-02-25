import { readFile } from "fs/promises";
import { createReadStream } from "fs";
import { join } from "path";
import readline from "readline";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { getResourceFilesDir, loadResources } from "@/lib/resources-store";

interface Params {
  params: Promise<{ id: string }>;
}

const MAX_PREVIEW_ROWS = 300;
const MAX_PREVIEW_COLS = 40;

function sheetToRows(workbook: XLSX.WorkBook) {
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) return [] as string[][];

  const range = XLSX.utils.decode_range(firstSheet["!ref"] || "A1:A1");
  const previewRange = {
    s: range.s,
    e: {
      r: Math.min(range.e.r, MAX_PREVIEW_ROWS - 1),
      c: Math.min(range.e.c, MAX_PREVIEW_COLS - 1),
    },
  };

  return XLSX.utils
    .sheet_to_json<(string | number | boolean | null)[]>(firstSheet, {
      header: 1,
      blankrows: false,
      range: XLSX.utils.encode_range(previewRange),
    })
    .map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))));
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = i + 1 < line.length ? line[i + 1] : "";

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

async function readCsvPreview(filePath: string) {
  const rows: string[][] = [];
  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  let totalRows = 0;
  let truncated = false;

  for await (const line of rl) {
    totalRows += 1;
    if (rows.length < MAX_PREVIEW_ROWS) {
      rows.push(parseCsvLine(line).slice(0, MAX_PREVIEW_COLS));
    } else {
      truncated = true;
    }
  }

  return { rows, totalRows, truncated };
}

export async function GET(_: Request, { params }: Params) {
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

    if (resource.document.mimeType === "application/pdf") {
      return NextResponse.json({
        mode: "pdf",
        title: resource.title,
        description: resource.description,
        fileName: resource.document.originalName,
        fileUrl: `/api/resources/file/${id}`,
        downloadUrl: `/api/resources/file/${id}?download=true`,
      });
    }

    if (resource.document.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const fileBuffer = await readFile(filePath);
      const html = (await mammoth.convertToHtml({ buffer: fileBuffer })).value;
      return NextResponse.json({
        mode: "docx",
        title: resource.title,
        description: resource.description,
        fileName: resource.document.originalName,
        html,
        downloadUrl: `/api/resources/file/${id}?download=true`,
      });
    }

    if (
      resource.document.mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      const fileBuffer = await readFile(filePath);
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      return NextResponse.json({
        mode: "table",
        title: resource.title,
        description: resource.description,
        fileName: resource.document.originalName,
        rows: sheetToRows(workbook),
        previewRows: MAX_PREVIEW_ROWS,
        previewCols: MAX_PREVIEW_COLS,
        truncated: true,
        downloadUrl: `/api/resources/file/${id}?download=true`,
      });
    }

    if (
      resource.document.mimeType === "text/csv" ||
      resource.document.mimeType === "application/vnd.ms-excel"
    ) {
      const { rows, totalRows, truncated } = await readCsvPreview(filePath);
      return NextResponse.json({
        mode: "table",
        title: resource.title,
        description: resource.description,
        fileName: resource.document.originalName,
        rows,
        totalRows,
        previewRows: MAX_PREVIEW_ROWS,
        previewCols: MAX_PREVIEW_COLS,
        truncated,
        downloadUrl: `/api/resources/file/${id}?download=true`,
      });
    }

    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  } catch (error) {
    console.error("[Resources View] GET error:", error);
    return NextResponse.json({ error: "Failed to prepare document preview" }, { status: 500 });
  }
}
