// ProConnect — Important Dates Bulk Import API
// POST: Parse CSV and create multiple important dates

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

interface ImportRow {
  label: string;
  subtitle: string;
  date: string;
  recurType: string;
  active: boolean;
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return []; // Need header + at least one row

  // Parse header
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));

  const labelIdx = header.findIndex((h) => h === "label" || h === "name" || h === "title");
  const subtitleIdx = header.findIndex((h) => h === "subtitle" || h === "sublabel" || h === "description");
  const dateIdx = header.findIndex((h) => h === "date");
  const recurIdx = header.findIndex((h) => h.includes("recur") || h === "type" || h === "recurring");
  const activeIdx = header.findIndex((h) => h === "active" || h === "enabled" || h === "status");

  if (labelIdx === -1 || dateIdx === -1) {
    throw new Error("CSV must contain 'Label' and 'Date' columns");
  }

  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parse (handles quoted fields)
    const cols = parseCSVLine(line);

    const label = cols[labelIdx]?.trim();
    const dateStr = cols[dateIdx]?.trim();

    if (!label || !dateStr) continue;

    // Validate date
    const parsed = new Date(dateStr + "T00:00:00Z");
    if (isNaN(parsed.getTime())) continue;

    // Parse subtitle
    let subtitle = "";
    if (subtitleIdx !== -1) {
      subtitle = (cols[subtitleIdx] || "").trim();
    }

    // Parse recurrence
    let recurType = "none";
    if (recurIdx !== -1) {
      const raw = (cols[recurIdx] || "").trim().toLowerCase();
      if (raw === "monthly" || raw === "month") recurType = "monthly";
      else if (raw === "first_workday" || raw === "first workday" || raw === "1st workday")
        recurType = "first_workday";
    }

    // Parse active
    let active = true;
    if (activeIdx !== -1) {
      const raw = (cols[activeIdx] || "").trim().toLowerCase();
      if (raw === "false" || raw === "no" || raw === "0" || raw === "inactive") active = false;
    }

    rows.push({ label, subtitle, date: dateStr, recurType, active });
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_IMPORTANT_DATES)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { csv } = body;

    if (!csv || typeof csv !== "string") {
      return NextResponse.json({ error: "CSV text is required" }, { status: 400 });
    }

    let rows: ImportRow[];
    try {
      rows = parseCSV(csv);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid CSV format";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found in CSV" }, { status: 400 });
    }

    // Get current max sort order
    const maxOrder = await prisma.importantDate.aggregate({ _max: { sortOrder: true } });
    let nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const created = await prisma.$transaction(
      rows.map((row) =>
        prisma.importantDate.create({
          data: {
            label: row.label,
            subtitle: row.subtitle || null,
            date: new Date(row.date + "T00:00:00Z"),
            recurType: row.recurType,
            active: row.active,
            sortOrder: nextOrder++,
          },
        })
      )
    );

    return NextResponse.json(
      { imported: created.length, dates: created },
      { status: 201 }
    );
  } catch (error) {
    console.error("[ImportantDates Import API] POST error:", error);
    return NextResponse.json({ error: "Failed to import" }, { status: 500 });
  }
}
