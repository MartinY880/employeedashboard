// ProConnect — Celebrations API
// GET: today's birthdays, anniversaries, and recent exam passes (public)
// POST: manually add a salesforce directory entry or exam record (admin)
// PATCH: update a salesforce directory entry or exam record (admin)
// DELETE: remove a salesforce directory entry or exam record (admin)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

export interface CelebrationItem {
  id: string;
  type: "birthday" | "anniversary" | "exam";
  employeeName: string;
  employeeId: string | null;
  email: string;
  detail: string;
  commentCount: number;
  likeCount: number;
  userLiked: boolean;
  previewComments: { id: string; authorName: string; content: string; createdAt: string }[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date"); // YYYY-MM-DD or null (today)

    // Use Eastern Time so the date doesn't roll over at 7 PM ET
    const eastern = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const etMonth = +eastern.find((p) => p.type === "month")!.value;
    const etDay = +eastern.find((p) => p.type === "day")!.value;
    const etYear = +eastern.find((p) => p.type === "year")!.value;

    let targetMonth: number, targetDay: number, targetYear: number;
    let isToday = true;

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [y, m, d] = dateParam.split("-").map(Number);
      targetYear = y;
      targetMonth = m;
      targetDay = d;
      isToday = targetYear === etYear && targetMonth === etMonth && targetDay === etDay;
    } else {
      targetYear = etYear;
      targetMonth = etMonth;
      targetDay = etDay;
    }

    // ── Parallel: fetch all source data + auth at the same time ──
    const [allEmps, examRecords, authResult] = await Promise.all([
      // Single query for both birthdays AND anniversaries (+ nextUp reuses this)
      prisma.salesforceDirectory.findMany({
        where: { OR: [{ birthday: { not: null } }, { employmentStartDate: { not: null } }] },
        select: { id: true, email: true, birthday: true, employmentStartDate: true },
      }),
      // Exams (today only)
      isToday
        ? prisma.examPassRecord.findMany({
            where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
            select: { email: true, employeeName: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      // Auth (start early instead of waiting until the end)
      getAuthUser(),
    ]);

    // ── Filter birthdays + anniversaries from the single query ──
    const birthdayEmails: string[] = [];
    const anniversaryEntries: { email: string; years: number }[] = [];

    for (const emp of allEmps) {
      if (emp.birthday) {
        const bd = new Date(emp.birthday);
        if (bd.getUTCMonth() + 1 === targetMonth && bd.getUTCDate() === targetDay) {
          birthdayEmails.push(emp.email);
        }
      }
      if (emp.employmentStartDate) {
        const sd = new Date(emp.employmentStartDate);
        if (sd.getUTCMonth() + 1 === targetMonth && sd.getUTCDate() === targetDay) {
          const years = targetYear - sd.getUTCFullYear();
          if (years > 0) {
            anniversaryEntries.push({ email: emp.email, years });
          }
        }
      }
    }

    // ── Resolve Entra names + IDs ──────────────────────
    const allEmails = [
      ...birthdayEmails,
      ...anniversaryEntries.map((e) => e.email),
      ...examRecords.map((e) => e.email),
    ];
    const uniqueEmails = [...new Set(allEmails.map((e) => e.toLowerCase()))];

    const entraSnapshots =
      uniqueEmails.length > 0
        ? await prisma.directorySnapshot.findMany({
            where: { mail: { in: uniqueEmails, mode: "insensitive" } },
            select: { id: true, displayName: true, mail: true },
          })
        : [];

    const entraByEmail = new Map(
      entraSnapshots.map((s) => [s.mail?.toLowerCase() ?? "", s])
    );

    // ── Build upsert data, then batch all upserts in a single transaction ──
    const eventDate = new Date(`${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}T00:00:00.000Z`);

    type UpsertEntry = {
      type: "birthday" | "anniversary" | "exam";
      email: string;
      employeeName: string;
      employeeId: string | null;
      detail: string;
    };
    const upsertEntries: UpsertEntry[] = [];

    for (const email of birthdayEmails) {
      const entra = entraByEmail.get(email.toLowerCase());
      upsertEntries.push({
        type: "birthday",
        email,
        employeeName: entra?.displayName ?? email.split("@")[0],
        employeeId: entra?.id ?? null,
        detail: "Happy Birthday! 🎂",
      });
    }
    for (const { email, years } of anniversaryEntries) {
      const entra = entraByEmail.get(email.toLowerCase());
      upsertEntries.push({
        type: "anniversary",
        email,
        employeeName: entra?.displayName ?? email.split("@")[0],
        employeeId: entra?.id ?? null,
        detail: `${years} Year${years !== 1 ? "s" : ""}! 🎉`,
      });
    }
    for (const rec of examRecords) {
      const entra = entraByEmail.get(rec.email.toLowerCase());
      upsertEntries.push({
        type: "exam",
        email: rec.email,
        employeeName: entra?.displayName ?? rec.email.split("@")[0],
        employeeId: entra?.id ?? null,
        detail: "Exam Passed! 🏆",
      });
    }

    // Batch all upserts in a single transaction (1 round-trip instead of N)
    const upsertResults = upsertEntries.length > 0
      ? await prisma.$transaction(
          upsertEntries.map((entry) =>
            prisma.celebrationEvent.upsert({
              where: { type_email_eventDate: { type: entry.type, email: entry.email, eventDate } },
              update: { employeeName: entry.employeeName, detail: entry.detail },
              create: { type: entry.type, email: entry.email, eventDate, employeeName: entry.employeeName, detail: entry.detail },
              select: { id: true, commentCount: true, likeCount: true },
            })
          )
        )
      : [];

    // ── Build items array ──
    const items: CelebrationItem[] = upsertEntries.map((entry, i) => ({
      id: upsertResults[i].id,
      type: entry.type,
      employeeName: entry.employeeName,
      employeeId: entry.employeeId,
      email: entry.email,
      detail: entry.detail,
      commentCount: upsertResults[i].commentCount,
      likeCount: upsertResults[i].likeCount,
      userLiked: false,
      previewComments: [],
    }));

    // Sort: birthdays first, then anniversaries, then exams
    const typeOrder: Record<string, number> = { birthday: 0, anniversary: 1, exam: 2 };
    const originalIndex = new Map(items.map((item, i) => [item, i]));
    items.sort((a, b) => {
      const ta = typeOrder[a.type] ?? 9;
      const tb = typeOrder[b.type] ?? 9;
      if (ta !== tb) return ta - tb;
      return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
    });

    // ── Resolve userLiked (auth already fetched in parallel) ──
    const { isAuthenticated, user: authUser } = authResult;
    if (isAuthenticated && authUser) {
      const dbUser = await prisma.user.findFirst({ where: { logtoId: authUser.sub }, select: { id: true } });
      if (dbUser && items.length > 0) {
        const likedRows = await prisma.celebrationLike.findMany({
          where: { userId: dbUser.id, celebrationId: { in: items.map((i) => i.id) } },
          select: { celebrationId: true },
        });
        const likedSet = new Set(likedRows.map((r) => r.celebrationId));
        for (const item of items) {
          item.userLiked = likedSet.has(item.id);
        }
      }
    }

    // ── Compute nextUp from the same allEmps data (no extra query) ──
    const todayStr = `${etYear}-${String(etMonth).padStart(2, "0")}-${String(etDay).padStart(2, "0")}`;
    const todayMidnight = new Date(`${todayStr}T00:00:00.000Z`);
    const baseStr = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr;
    const baseMidnight = new Date(`${baseStr}T00:00:00.000Z`);
    const baseYear = +baseStr.slice(0, 4);

    function nextOccurrence(month: number, day: number) {
      let year = baseYear;
      let candidate = new Date(Date.UTC(year, month - 1, day));
      if (candidate <= baseMidnight) {
        year++;
        candidate = new Date(Date.UTC(year, month - 1, day));
      }
      return {
        dateStr: candidate.toISOString().slice(0, 10),
        daysAway: Math.ceil((candidate.getTime() - todayMidnight.getTime()) / 86400000),
        year,
      };
    }

    let best: { email: string; type: "birthday" | "anniversary"; dateStr: string; daysAway: number } | null = null;
    for (const emp of allEmps) {
      if (emp.birthday) {
        const bd = new Date(emp.birthday);
        const occ = nextOccurrence(bd.getUTCMonth() + 1, bd.getUTCDate());
        if (!best || occ.daysAway < best.daysAway) {
          best = { email: emp.email, type: "birthday", dateStr: occ.dateStr, daysAway: occ.daysAway };
        }
      }
      if (emp.employmentStartDate) {
        const sd = new Date(emp.employmentStartDate);
        const occ = nextOccurrence(sd.getUTCMonth() + 1, sd.getUTCDate());
        if (occ.year > sd.getUTCFullYear() && (!best || occ.daysAway < best.daysAway)) {
          best = { email: emp.email, type: "anniversary", dateStr: occ.dateStr, daysAway: occ.daysAway };
        }
      }
    }

    let nextUpResult = null;
    if (best) {
      const entra = entraByEmail.get(best.email.toLowerCase())
        ?? (await prisma.directorySnapshot.findFirst({
            where: { mail: { equals: best.email, mode: "insensitive" } },
            select: { id: true, displayName: true },
          }));
      nextUpResult = {
        employeeName: entra?.displayName ?? best.email.split("@")[0],
        employeeId: entra?.id ?? null,
        email: best.email,
        type: best.type,
        eventDate: best.dateStr,
        daysAway: best.daysAway,
      };
    }

    return NextResponse.json({
      items,
      hasBirthdays: birthdayEmails.length > 0,
      hasAnniversaries: anniversaryEntries.length > 0,
      hasExams: examRecords.length > 0,
      nextUp: nextUpResult,
    });
  } catch (err) {
    console.error("[celebrations] GET error:", err);
    return NextResponse.json({ items: [], hasBirthdays: false, hasAnniversaries: false, hasExams: false, nextUp: null });
  }
}

// ── Admin: list all records for management ─────────────────
export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_CELEBRATIONS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    // List all records (for admin table)
    if (action === "list") {
      const [directory, exams, employees] = await Promise.all([
        prisma.salesforceDirectory.findMany({
          orderBy: { email: "asc" },
          include: { examPassRecord: true },
        }),
        prisma.examPassRecord.findMany({
          orderBy: { createdAt: "desc" },
        }),
        prisma.directorySnapshot.findMany({
          select: { id: true, displayName: true, mail: true, jobTitle: true, department: true },
          orderBy: { displayName: "asc" },
        }),
      ]);
      return NextResponse.json({ directory, exams, employees });
    }

    // Create or overwrite a directory entry
    if (action === "createDirectory") {
      const { id, email, birthday, employmentStartDate } = body;
      if (!id || !email) {
        return NextResponse.json({ error: "id and email are required" }, { status: 400 });
      }
      const normalizedEmail = email.toLowerCase().trim();
      const data = {
        id,
        email: normalizedEmail,
        birthday: birthday ? new Date(birthday) : null,
        employmentStartDate: employmentStartDate ? new Date(employmentStartDate) : null,
      };
      const created = await prisma.salesforceDirectory.upsert({
        where: { email: normalizedEmail },
        create: data,
        update: {
          birthday: data.birthday,
          employmentStartDate: data.employmentStartDate,
        },
      });
      return NextResponse.json({ record: created }, { status: 201 });
    }

    // Create a new exam pass record
    if (action === "createExam") {
      const { id, email, employeeName } = body;
      if (!email || !employeeName) {
        return NextResponse.json({ error: "email and employeeName are required" }, { status: 400 });
      }
      const normalizedEmail = email.toLowerCase().trim();

      // Ensure a salesforce_directory entry exists (FK requirement)
      await prisma.salesforceDirectory.upsert({
        where: { email: normalizedEmail },
        create: { id: id || normalizedEmail, email: normalizedEmail },
        update: {},
      });

      // Upsert exam record — overwrites if Salesforce re-sends for the same email
      const created = await prisma.examPassRecord.upsert({
        where: { email: normalizedEmail },
        create: {
          email: normalizedEmail,
          employeeName,
        },
        update: {
          employeeName,
          createdAt: new Date(),
        },
      });
      return NextResponse.json({ record: created }, { status: 201 });
    }

    // ── Bulk CSV import for directory entries ───────────
    // Expected columns: id (Salesforce ID), email, birthday (optional), employmentStartDate (optional)
    if (action === "importDirectory") {
      const { csvText } = body;
      if (!csvText || typeof csvText !== "string") {
        return NextResponse.json({ error: "csvText is required" }, { status: 400 });
      }
      const { rows, errors } = parseCsvRows(csvText, ["id"]);
      let imported = 0;
      for (const row of rows) {
        const id = (row.id || "").trim();
        if (!id) continue;

        // Detect swapped email / employee_name columns (Salesforce exports may vary)
        const col2 = (row.email || "").trim();
        const col3 = (row.employee_name || "").trim();
        const email = (col2.includes("@") ? col2 : col3.includes("@") ? col3 : "").toLowerCase();
        if (!email) continue;
        const birthday = parseDate(row.birthday || row.date_of_birth || row.dob || row.birthdate);
        const startDate = parseDate(row.employmentstartdate || row.employment_start_date || row.start_date || row.hire_date || row.hiredate);

        // If a different record already owns this email, remove it first so the upsert-by-id won't hit a unique constraint
        const existingByEmail = await prisma.salesforceDirectory.findUnique({ where: { email } });
        if (existingByEmail && existingByEmail.id !== id) {
          // Cascade: remove any exam record tied to this email first (FK)
          await prisma.examPassRecord.deleteMany({ where: { email } });
          await prisma.salesforceDirectory.delete({ where: { email } });
        }

        await prisma.salesforceDirectory.upsert({
          where: { id },
          create: { id, email, birthday, employmentStartDate: startDate },
          update: {
            email,
            ...(birthday !== undefined ? { birthday } : {}),
            ...(startDate !== undefined ? { employmentStartDate: startDate } : {}),
          },
        });
        imported++;
      }
      // Reload
      const directory = await prisma.salesforceDirectory.findMany({
        orderBy: { email: "asc" },
        include: { examPassRecord: true },
      });
      return NextResponse.json({ imported, errors, directory }, { status: 200 });
    }

    // ── Bulk CSV import for exam records ────────────────
    // Expected columns: email, employeeName (or employee_name or name)
    if (action === "importExams") {
      const { csvText } = body;
      if (!csvText || typeof csvText !== "string") {
        return NextResponse.json({ error: "csvText is required" }, { status: 400 });
      }
      const { rows, errors } = parseCsvRows(csvText, ["email"]);
      let imported = 0;
      for (const row of rows) {
        const email = row.email.toLowerCase().trim();
        if (!email || !email.includes("@")) continue;
        const employeeName = row.employeename || row.employee_name || row.name || row.full_name || email.split("@")[0];
        // Ensure directory entry exists (FK)
        await prisma.salesforceDirectory.upsert({
          where: { email },
          create: { id: email, email },
          update: {},
        });
        await prisma.examPassRecord.upsert({
          where: { email },
          create: { email, employeeName },
          update: { employeeName, createdAt: new Date() },
        });
        imported++;
      }
      // Reload
      const exams = await prisma.examPassRecord.findMany({ orderBy: { createdAt: "desc" } });
      return NextResponse.json({ imported, errors, exams }, { status: 200 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[celebrations] POST error:", err);
    return NextResponse.json({ error: "Failed to create record" }, { status: 500 });
  }
}

// ── CSV parsing helpers ─────────────────────────────────────
function parseCsvRows(
  csvText: string,
  requiredCols: string[],
): { rows: Record<string, string>[]; errors: string[] } {
  const errors: string[] = [];
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    errors.push("CSV must have a header row and at least one data row.");
    return { rows: [], errors };
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""));
  for (const col of requiredCols) {
    if (!headers.includes(col)) {
      errors.push(`Missing required column: ${col}`);
    }
  }
  if (errors.length > 0) return { rows: [], errors };

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    if (values.length === 0) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || "").trim();
    });
    rows.push(row);
  }
  return { rows, errors };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseDate(value: string | undefined | null): Date | null | undefined {
  if (!value || !value.trim()) return undefined;
  const d = new Date(value.trim());
  return isNaN(d.getTime()) ? undefined : d;
}

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_CELEBRATIONS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { type, id, email, birthday, employmentStartDate, employeeName } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (type === "directory") {
      const data: Record<string, unknown> = {};
      if (email !== undefined) data.email = email.toLowerCase().trim();
      if (birthday !== undefined) data.birthday = birthday ? new Date(birthday) : null;
      if (employmentStartDate !== undefined) data.employmentStartDate = employmentStartDate ? new Date(employmentStartDate) : null;

      const updated = await prisma.salesforceDirectory.update({ where: { id }, data });
      return NextResponse.json({ record: updated });
    }

    if (type === "exam") {
      const data: Record<string, unknown> = {};
      if (email !== undefined) data.email = email.toLowerCase().trim();
      if (employeeName !== undefined) data.employeeName = employeeName;

      const updated = await prisma.examPassRecord.update({ where: { id }, data });
      return NextResponse.json({ record: updated });
    }

    return NextResponse.json({ error: "type must be 'directory' or 'exam'" }, { status: 400 });
  } catch (err) {
    console.error("[celebrations] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update record" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_CELEBRATIONS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!id || !type) {
      return NextResponse.json({ error: "type and id are required" }, { status: 400 });
    }

    if (type === "directory") {
      // Delete exam record first if it exists (FK constraint)
      const entry = await prisma.salesforceDirectory.findUnique({
        where: { id },
        select: { email: true },
      });
      if (entry) {
        await prisma.examPassRecord.deleteMany({ where: { email: entry.email } });
      }
      await prisma.salesforceDirectory.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    if (type === "exam") {
      await prisma.examPassRecord.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "type must be 'directory' or 'exam'" }, { status: 400 });
  } catch (err) {
    console.error("[celebrations] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete record" }, { status: 500 });
  }
}
