// ProConnect — Calendar API Route
// Native holiday CRUD from PostgreSQL via Prisma
// Supports: GET (list/filter), POST (create), PUT (update), DELETE (remove)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── Recurring important-date resolver ─────────────────────
   Recurring important_dates are stored with a one-time resolved date.
   On every GET we recalculate the next occurrence so they roll forward
   automatically without any DB writes.
 ─────────────────────────────────────────────────────────── */
function adjustToWorkday(d: Date): Date {
  const dow = d.getDay();
  if (dow === 6) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2);
  if (dow === 0) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return d;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveRecurringImportantDate(h: any): any {
  if (h.category !== "important_dates") return h;
  const src: string = h.source || "";
  if (!src.startsWith("important_dates:")) return h;
  const recurType = src.split(":")[1];
  if (!recurType || recurType === "none") return h;

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const [ty, tmRaw] = todayStr.split("-").map(Number);
  let year = ty;
  let month = tmRaw - 1; // 0-indexed

  let resolvedDate: string;

  if (recurType === "first_workday") {
    let candidate = adjustToWorkday(new Date(year, month, 1));
    if (candidate.toLocaleDateString("en-CA") < todayStr) {
      month += 1;
      if (month > 11) { month = 0; year++; }
      candidate = adjustToWorkday(new Date(year, month, 1));
    }
    resolvedDate = candidate.toLocaleDateString("en-CA");
  } else if (recurType === "monthly") {
    const day = new Date(h.date + "T00:00:00").getDate();
    let candidate = new Date(year, month, day);
    if (candidate.toLocaleDateString("en-CA") < todayStr) {
      month += 1;
      if (month > 11) { month = 0; year++; }
      candidate = new Date(year, month, day);
    }
    resolvedDate = candidate.toLocaleDateString("en-CA");
  } else {
    return h;
  }

  return { ...h, date: resolvedDate };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const category = searchParams.get("category");
    const includeHidden = searchParams.get("includeHidden") === "true";
    const statsOnly = searchParams.get("stats") === "true";
    const countOnly = searchParams.get("count") === "true";

    // Stats summary for admin dashboard
    if (statsOnly) {
      const currentYear = (year || new Date().getFullYear()).toString();
      const [total, federal, fun, company, hidden] = await Promise.all([
        prisma.holiday.count({ where: { date: { startsWith: currentYear } } }),
        prisma.holiday.count({ where: { date: { startsWith: currentYear }, category: "federal" } }),
        prisma.holiday.count({ where: { date: { startsWith: currentYear }, category: "fun" } }),
        prisma.holiday.count({ where: { date: { startsWith: currentYear }, category: "company" } }),
        prisma.holiday.count({ where: { date: { startsWith: currentYear }, visible: false } }),
      ]);
      return NextResponse.json({ total, federal, fun, company, hidden, year: currentYear });
    }

    // Count of upcoming visible holidays (for stat cards)
    if (countOnly) {
      const today = new Date().toISOString().split("T")[0];
      const count = await prisma.holiday.count({
        where: { visible: true, date: { gte: today } },
      });
      return NextResponse.json({ count });
    }

    // Build filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (year) where.date = { startsWith: year };
    if (category) where.category = category;
    if (!includeHidden) where.visible = true;

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: { date: "asc" },
      include: { event: { include: { flyer: true } } },
    });

    const processed = holidays.map(resolveRecurringImportantDate);
    return NextResponse.json(processed);
  } catch (error) {
    console.error("[Calendar API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch holidays" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, date, category, color, source, visible, recurring, startTime, endTime, location, description, htmlContent, lightboxWidth, pdfHeight } = body;

    if (!title || !date || !category) {
      return NextResponse.json(
        { error: "Title, date, and category are required" },
        { status: 400 }
      );
    }

    const holiday = await prisma.holiday.create({
      data: {
        title,
        date,
        category,
        color: color || "#06427F",
        source: source || "custom",
        visible: visible !== undefined ? visible : true,
        recurring: recurring || false,
      },
    });

    if (startTime || endTime || location || description || htmlContent || lightboxWidth || pdfHeight) {
      await prisma.holidayEvent.create({
        data: {
          holidayId: holiday.id,
          startTime: startTime ? new Date(startTime) : null,
          endTime: endTime ? new Date(endTime) : null,
          location: location || null,
          description: description || null,
          htmlContent: htmlContent || null,
          lightboxWidth: lightboxWidth ? parseInt(lightboxWidth, 10) : null,
          pdfHeight: pdfHeight ? parseInt(pdfHeight, 10) : null,
        },
      });
    }

    const withEvent = await prisma.holiday.findUnique({
      where: { id: holiday.id },
      include: { event: { include: { flyer: true } } },
    });

    return NextResponse.json(withEvent, { status: 201 });
  } catch (error) {
    console.error("[Calendar API] POST error:", error);
    return NextResponse.json({ error: "Failed to create holiday" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, title, date, category, color, visible, recurring, startTime, endTime, location, description, htmlContent, lightboxWidth, pdfHeight } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.holiday.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(date !== undefined && { date }),
        ...(category !== undefined && { category }),
        ...(color !== undefined && { color }),
        ...(visible !== undefined && { visible }),
        ...(recurring !== undefined && { recurring }),
      },
    });

    // Always upsert event when editing (allows clearing fields)
    await prisma.holidayEvent.upsert({
      where: { holidayId: id },
      update: {
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        location: location || null,
        description: description || null,
        htmlContent: htmlContent || null,
        lightboxWidth: lightboxWidth ? parseInt(lightboxWidth, 10) : null,
        pdfHeight: pdfHeight ? parseInt(pdfHeight, 10) : null,
      },
      create: {
        holidayId: id,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        location: location || null,
        description: description || null,
        htmlContent: htmlContent || null,
        lightboxWidth: lightboxWidth ? parseInt(lightboxWidth, 10) : null,
        pdfHeight: pdfHeight ? parseInt(pdfHeight, 10) : null,
      },
    });

    const withEvent = await prisma.holiday.findUnique({
      where: { id },
      include: { event: { include: { flyer: true } } },
    });

    return NextResponse.json(withEvent);
  } catch (error) {
    console.error("[Calendar API] PUT error:", error);
    return NextResponse.json({ error: "Failed to update holiday" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const bulkSource = searchParams.get("bulkSource");
    const bulkAll = searchParams.get("bulkAll") === "true";

    if (bulkAll) {
      const result = await prisma.holiday.deleteMany({});
      return NextResponse.json({ message: `Deleted ${result.count} holidays` });
    }

    if (bulkSource) {
      const result = await prisma.holiday.deleteMany({ where: { source: bulkSource } });
      return NextResponse.json({ message: `Deleted ${result.count} ${bulkSource} holidays` });
    }

    // Bulk delete by IDs (from request body)
    const bulkIds = searchParams.get("bulkIds");
    if (bulkIds) {
      try {
        const ids: string[] = JSON.parse(bulkIds);
        if (Array.isArray(ids) && ids.length > 0) {
          const result = await prisma.holiday.deleteMany({ where: { id: { in: ids } } });
          return NextResponse.json({ message: `Deleted ${result.count} selected holidays` });
        }
      } catch {
        return NextResponse.json({ error: "Invalid bulkIds format" }, { status: 400 });
      }
    }

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.holiday.delete({ where: { id } });
    return NextResponse.json({ message: "Holiday deleted" });
  } catch (error) {
    console.error("[Calendar API] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete holiday" }, { status: 500 });
  }
}
