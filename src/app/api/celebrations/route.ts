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
  employeeId: string | null; // Entra user ID for photo lookup
  email: string;
  detail: string; // e.g. "3 Years!" or "Happy Birthday!" or "Exam Passed!"
}

export async function GET() {
  try {
    const now = new Date();
    const todayMonth = now.getMonth() + 1; // 1-based
    const todayDay = now.getDate();

    // ── Birthdays (today only) ─────────────────────────
    const allWithBirthday = await prisma.salesforceDirectory.findMany({
      where: { birthday: { not: null } },
      select: { id: true, email: true, birthday: true },
    });

    const birthdayEmails: string[] = [];
    for (const emp of allWithBirthday) {
      if (!emp.birthday) continue;
      const bd = new Date(emp.birthday);
      if (bd.getUTCMonth() + 1 === todayMonth && bd.getUTCDate() === todayDay) {
        birthdayEmails.push(emp.email);
      }
    }

    // ── Anniversaries (today only) ─────────────────────
    const allWithStartDate = await prisma.salesforceDirectory.findMany({
      where: { employmentStartDate: { not: null } },
      select: { id: true, email: true, employmentStartDate: true },
    });

    const anniversaryEntries: { email: string; years: number }[] = [];
    for (const emp of allWithStartDate) {
      if (!emp.employmentStartDate) continue;
      const sd = new Date(emp.employmentStartDate);
      if (sd.getUTCMonth() + 1 === todayMonth && sd.getUTCDate() === todayDay) {
        const years = now.getFullYear() - sd.getUTCFullYear();
        if (years > 0) {
          anniversaryEntries.push({ email: emp.email, years });
        }
      }
    }

    // ── Exams Passed (last 30 days) ────────────────────
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const examRecords = await prisma.examPassRecord.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { email: true, employeeName: true },
    });

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
            where: {
              mail: { in: uniqueEmails, mode: "insensitive" },
            },
            select: { id: true, displayName: true, mail: true },
          })
        : [];

    const entraByEmail = new Map(
      entraSnapshots.map((s) => [s.mail?.toLowerCase() ?? "", s])
    );

    // ── Build items ────────────────────────────────────
    const items: CelebrationItem[] = [];

    for (const email of birthdayEmails) {
      const entra = entraByEmail.get(email.toLowerCase());
      items.push({
        id: `bday-${email}`,
        type: "birthday",
        employeeName: entra?.displayName ?? email.split("@")[0],
        employeeId: entra?.id ?? null,
        email,
        detail: "Happy Birthday! 🎂",
      });
    }

    for (const { email, years } of anniversaryEntries) {
      const entra = entraByEmail.get(email.toLowerCase());
      items.push({
        id: `anniv-${email}`,
        type: "anniversary",
        employeeName: entra?.displayName ?? email.split("@")[0],
        employeeId: entra?.id ?? null,
        email,
        detail: `${years} Year${years !== 1 ? "s" : ""}! 🎉`,
      });
    }

    for (const rec of examRecords) {
      const entra = entraByEmail.get(rec.email.toLowerCase());
      items.push({
        id: `exam-${rec.email}`,
        type: "exam",
        employeeName: entra?.displayName ?? rec.email.split("@")[0],
        employeeId: entra?.id ?? null,
        email: rec.email,
        detail: "Exam Passed! 🏆",
      });
    }

    return NextResponse.json({
      items,
      hasBirthdays: birthdayEmails.length > 0,
      hasAnniversaries: anniversaryEntries.length > 0,
      hasExams: examRecords.length > 0,
    });
  } catch (err) {
    console.error("[celebrations] GET error:", err);
    return NextResponse.json({ items: [], hasBirthdays: false, hasAnniversaries: false, hasExams: false });
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
    // Expected columns: email, birthday (optional), employmentStartDate (optional)
    if (action === "importDirectory") {
      const { csvText } = body;
      if (!csvText || typeof csvText !== "string") {
        return NextResponse.json({ error: "csvText is required" }, { status: 400 });
      }
      const { rows, errors } = parseCsvRows(csvText, ["email"]);
      let imported = 0;
      for (const row of rows) {
        const email = row.email.toLowerCase().trim();
        if (!email || !email.includes("@")) continue;
        const birthday = parseDate(row.birthday || row.date_of_birth || row.dob || row.birthdate);
        const startDate = parseDate(row.employmentstartdate || row.employment_start_date || row.start_date || row.hire_date || row.hiredate);
        await prisma.salesforceDirectory.upsert({
          where: { email },
          create: { id: email, email, birthday, employmentStartDate: startDate },
          update: {
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
