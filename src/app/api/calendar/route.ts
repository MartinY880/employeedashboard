// ProConnect — Calendar API Route
// Native holiday CRUD from PostgreSQL via Prisma
// Supports: GET (list/filter), POST (create), PUT (update), DELETE (remove)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    });

    return NextResponse.json(holidays);
  } catch (error) {
    console.error("[Calendar API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch holidays" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, date, category, color, source, visible, recurring } = body;

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

    return NextResponse.json(holiday, { status: 201 });
  } catch (error) {
    console.error("[Calendar API] POST error:", error);
    return NextResponse.json({ error: "Failed to create holiday" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, title, date, category, color, visible, recurring } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const holiday = await prisma.holiday.update({
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

    return NextResponse.json(holiday);
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
