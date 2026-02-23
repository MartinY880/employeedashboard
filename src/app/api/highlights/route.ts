// ProConnect — Employee Highlights API
// GET  = active highlight(s), POST = create, PUT = update, DELETE = remove

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

/* ------------------------------------------------------------------ */
/*  Demo data (used when DB table doesn't exist yet)                  */
/* ------------------------------------------------------------------ */

interface DemoHighlight {
  id: string;
  employeeId: string | null;
  employeeName: string;
  jobTitle: string | null;
  department: string | null;
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  active: boolean;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

function buildPhotoUrl(employeeId: string, employeeName: string): string {
  return `/api/directory/photo?userId=${encodeURIComponent(employeeId)}&name=${encodeURIComponent(employeeName)}&size=120x120`;
}

const demoHighlights: DemoHighlight[] = [
  {
    id: "demo-hl-1",
    employeeId: "demo-1",
    employeeName: "Sarah Mitchell",
    jobTitle: "CEO",
    department: "Executive",
    title: "Employee of the Month",
    subtitle: "Closed 12 loans this month with a perfect customer satisfaction score. Sarah goes above and beyond every single day!",
    avatarUrl: buildPhotoUrl("demo-1", "Sarah Mitchell"),
    active: true,
    startDate: new Date().toISOString(),
    endDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/* ------------------------------------------------------------------ */
/*  GET                                                                */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";

  try {
    const highlights = await prisma.employeeHighlight.findMany({
      where: all ? {} : { active: true },
      orderBy: { startDate: "desc" },
    });

    // If DB is empty, show demo data
    if (highlights.length === 0) {
      if (all) return NextResponse.json(demoHighlights);
      return NextResponse.json(demoHighlights.filter((h) => h.active));
    }

    return NextResponse.json(highlights);
  } catch {
    // Demo fallback
    if (all) return NextResponse.json(demoHighlights);
    return NextResponse.json(demoHighlights.filter((h) => h.active));
  }
}

/* ------------------------------------------------------------------ */
/*  POST                                                               */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const { isAuthenticated, user } = await getAuthUser();
  if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_HIGHLIGHTS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { employeeId, employeeName, jobTitle, department, title, subtitle, startDate, endDate } = body;

  if (!employeeName || !title || !subtitle) {
    return NextResponse.json({ error: "employeeName, title, and subtitle are required" }, { status: 400 });
  }

  // Auto-generate avatar URL from directory photo proxy
  const avatarUrl = employeeId ? buildPhotoUrl(employeeId, employeeName) : null;

  try {
    const highlight = await prisma.employeeHighlight.create({
      data: {
        employeeId: employeeId || null,
        employeeName,
        jobTitle: jobTitle || null,
        department: department || null,
        title,
        subtitle,
        avatarUrl,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    return NextResponse.json(highlight, { status: 201 });
  } catch {
    const newHighlight: DemoHighlight = {
      id: `demo-hl-${Date.now()}`,
      employeeId: employeeId || null,
      employeeName,
      jobTitle: jobTitle || null,
      department: department || null,
      title,
      subtitle,
      avatarUrl,
      active: true,
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    demoHighlights.unshift(newHighlight);
    return NextResponse.json(newHighlight, { status: 201 });
  }
}

/* ------------------------------------------------------------------ */
/*  PUT                                                                */
/* ------------------------------------------------------------------ */

export async function PUT(req: NextRequest) {
  const { isAuthenticated, user } = await getAuthUser();
  if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_HIGHLIGHTS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, ...fields } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const data: Record<string, unknown> = {};
    if (fields.employeeId !== undefined) data.employeeId = fields.employeeId;
    if (fields.employeeName !== undefined) data.employeeName = fields.employeeName;
    if (fields.jobTitle !== undefined) data.jobTitle = fields.jobTitle;
    if (fields.department !== undefined) data.department = fields.department;
    if (fields.title !== undefined) data.title = fields.title;
    if (fields.subtitle !== undefined) data.subtitle = fields.subtitle;
    if (fields.avatarUrl !== undefined) data.avatarUrl = fields.avatarUrl;
    if (fields.active !== undefined) data.active = fields.active;
    if (fields.startDate !== undefined) data.startDate = new Date(fields.startDate);
    if (fields.endDate !== undefined) data.endDate = fields.endDate ? new Date(fields.endDate) : null;

    // Auto-regenerate avatar if employeeId changed
    if (fields.employeeId && fields.employeeName) {
      data.avatarUrl = buildPhotoUrl(fields.employeeId, fields.employeeName);
    }

    const highlight = await prisma.employeeHighlight.update({
      where: { id },
      data,
    });
    return NextResponse.json(highlight);
  } catch {
    const idx = demoHighlights.findIndex((h) => h.id === id);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
    Object.assign(demoHighlights[idx], fields, { updatedAt: new Date().toISOString() });
    return NextResponse.json(demoHighlights[idx]);
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE                                                             */
/* ------------------------------------------------------------------ */

export async function DELETE(req: NextRequest) {
  const { isAuthenticated, user } = await getAuthUser();
  if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_HIGHLIGHTS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id param is required" }, { status: 400 });
  }

  try {
    await prisma.employeeHighlight.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    const idx = demoHighlights.findIndex((h) => h.id === id);
    if (idx !== -1) demoHighlights.splice(idx, 1);
    return NextResponse.json({ success: true });
  }
}
