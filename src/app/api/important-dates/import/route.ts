// ProConnect — Important Dates Bulk Import API
// POST: Parse CSV and create calendar holidays under category "important_dates"

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

/* ── Date resolution helpers ────────────────────────────── */

function easternToday(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return new Date(
    +parts.find((p) => p.type === "year")!.value,
    +parts.find((p) => p.type === "month")!.value - 1,
    +parts.find((p) => p.type === "day")!.value,
  );
}

function adjustToWorkday(d: Date): Date {
  const dow = d.getDay();
  if (dow === 6) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2);
  if (dow === 0) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return d;
}

function resolveToDateStr(dateStr: string, recurType: string): string {
  const today = easternToday();
  const base = new Date(dateStr + "T00:00:00");
  let resolved: Date;

  if (recurType === "first_workday") {
    let candidate = new Date(today.getFullYear(), today.getMonth(), 1);
    candidate = adjustToWorkday(candidate);
    if (candidate < today) {
      candidate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      candidate = adjustToWorkday(candidate);
    }
    resolved = candidate;
  } else if (recurType === "monthly") {
    const day = base.getDate();
    let next = new Date(today.getFullYear(), today.getMonth(), day);
    if (next < today) {
      next = new Date(today.getFullYear(), today.getMonth() + 1, day);
    }
    resolved = next;
  } else {
    resolved = base;
  }

  return resolved.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

/* ── CSV parsing ─────────────────────────────────────────── */

function parseCSV(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

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

    const cols = parseCSVLine(line);
    const label = cols[labelIdx]?.trim();
    const dateStr = cols[dateIdx]?.trim();
    if (!label || !dateStr) continue;

    const parsed = new Date(dateStr + "T00:00:00Z");
    if (isNaN(parsed.getTime())) continue;

    let subtitle = "";
    if (subtitleIdx !== -1) subtitle = (cols[subtitleIdx] || "").trim();

    let recurType = "none";
    if (recurIdx !== -1) {
      const raw = (cols[recurIdx] || "").trim().toLowerCase();
      if (raw === "monthly" || raw === "month") recurType = "monthly";
      else if (raw === "first_workday" || raw === "first workday" || raw === "1st workday")
        recurType = "first_workday";
    }

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

/* ── POST ────────────────────────────────────────────────── */

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

    const created = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const row of rows) {
        const resolvedDate = resolveToDateStr(row.date, row.recurType);
        const source = row.recurType !== "none" ? `important_dates:${row.recurType}` : "important_dates";

        const holiday = await tx.holiday.create({
          data: {
            title: row.label,
            date: resolvedDate,
            category: "important_dates",
            color: "#dc2626",
            source,
            visible: row.active,
            recurring: row.recurType !== "none",
          },
        });

        if (row.subtitle) {
          await tx.holidayEvent.create({
            data: { holidayId: holiday.id, description: row.subtitle },
          });
        }

        results.push(holiday);
      }
      return results;
    });

    return NextResponse.json({ imported: created.length, dates: created }, { status: 201 });
  } catch (error) {
    console.error("[ImportantDates Import API] POST error:", error);
    return NextResponse.json({ error: "Failed to import" }, { status: 500 });
  }
}


