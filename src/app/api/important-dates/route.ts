// ProConnect — Important Dates API
// Backed by the calendar (holidays) table with category "important_dates"
// Preserves the same request/response interface so the admin page needs no changes

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

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

/** Resolve a base date + recurType to the next upcoming YYYY-MM-DD occurrence */
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

/* ── Response mapper ────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToItem(h: any) {
  const src: string = h.source ?? "important_dates";
  const recurType = src.startsWith("important_dates:")
    ? (src.split(":")[1] ?? "none")
    : "none";
  return {
    id: h.id,
    label: h.title,
    subtitle: h.event?.description ?? null,
    date: h.date,       // YYYY-MM-DD — compatible with existing admin page date helpers
    recurType,
    sortOrder: 0,
    active: h.visible,
    createdAt: h.createdAt?.toISOString?.() ?? h.createdAt,
    updatedAt: h.updatedAt?.toISOString?.() ?? h.updatedAt,
  };
}

/* ── GET ─────────────────────────────────────────────────── */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";

    const holidays = await prisma.holiday.findMany({
      where: {
        category: "important_dates",
        ...(all ? {} : { visible: true }),
      },
      include: { event: true },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ dates: holidays.map(mapToItem) });
  } catch (error) {
    console.error("[ImportantDates API] GET error:", error);
    return NextResponse.json({ dates: [] });
  }
}

/* ── POST ────────────────────────────────────────────────── */

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_IMPORTANT_DATES)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { label, date, recurType = "none", subtitle } = body;

    if (!label?.trim() || !date) {
      return NextResponse.json({ error: "Label and date are required" }, { status: 400 });
    }

    const resolvedDate = resolveToDateStr(date, recurType);
    const source = recurType !== "none" ? `important_dates:${recurType}` : "important_dates";

    const holiday = await prisma.holiday.create({
      data: {
        title: label.trim(),
        date: resolvedDate,
        category: "important_dates",
        color: "#dc2626",
        source,
        visible: true,
        recurring: recurType !== "none",
      },
    });

    if (subtitle?.trim()) {
      await prisma.holidayEvent.create({
        data: { holidayId: holiday.id, description: subtitle.trim() },
      });
    }

    const withEvent = await prisma.holiday.findUnique({
      where: { id: holiday.id },
      include: { event: true },
    });

    return NextResponse.json({ date: mapToItem(withEvent) }, { status: 201 });
  } catch (error) {
    console.error("[ImportantDates API] POST error:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

/* ── PUT ─────────────────────────────────────────────────── */

export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_IMPORTANT_DATES)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, label, date, recurType, active, subtitle } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};
    if (label !== undefined) updateData.title = label.trim();
    if (active !== undefined) updateData.visible = active;
    if (recurType !== undefined) {
      updateData.source = recurType !== "none" ? `important_dates:${recurType}` : "important_dates";
      updateData.recurring = recurType !== "none";
    }
    if (date !== undefined) {
      updateData.date = resolveToDateStr(date, recurType ?? "none");
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.holiday.update({ where: { id }, data: updateData });
    }

    if (subtitle !== undefined) {
      await prisma.holidayEvent.upsert({
        where: { holidayId: id },
        create: { holidayId: id, description: subtitle?.trim() || null },
        update: { description: subtitle?.trim() || null },
      });
    }

    const updated = await prisma.holiday.findUnique({
      where: { id },
      include: { event: true },
    });

    return NextResponse.json({ date: mapToItem(updated) });
  } catch (error) {
    console.error("[ImportantDates API] PUT error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

/* ── DELETE ──────────────────────────────────────────────── */

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_IMPORTANT_DATES)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.holiday.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ImportantDates API] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
