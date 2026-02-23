// ProConnect — Quick Links API Route
// GET: Fetch active quick links | POST: Create | PUT: Update | DELETE: Remove

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

// Demo quick links for when DB is unavailable
const DEMO_QUICK_LINKS = [
  { id: "ql-1", label: "Encompass", url: "https://encompass.example.com", icon: "building", sortOrder: 0, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "ql-2", label: "ADP Payroll", url: "https://adp.example.com", icon: "wallet", sortOrder: 1, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "ql-3", label: "Slack", url: "https://slack.com", icon: "message-circle", sortOrder: 2, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "ql-4", label: "Company Wiki", url: "https://wiki.example.com", icon: "book-open", sortOrder: 3, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "ql-5", label: "IT Help Desk", url: "https://helpdesk.example.com", icon: "headset", sortOrder: 4, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "ql-6", label: "Training Portal", url: "https://training.example.com", icon: "graduation-cap", sortOrder: 5, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const demoLinks: any[] = [...DEMO_QUICK_LINKS];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true"; // admin wants all including inactive

    const links = await prisma.quickLink.findMany({
      where: all ? undefined : { active: true },
      orderBy: { sortOrder: "asc" },
    });

    // If DB is empty, show demo data
    if (links.length === 0) {
      const filtered = all ? demoLinks : demoLinks.filter((l) => l.active);
      return NextResponse.json({ links: filtered, demo: true });
    }

    return NextResponse.json({ links });
  } catch (error) {
    console.error("[QuickLinks API] GET error (using demo):", error);
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";
    const filtered = all ? demoLinks : demoLinks.filter((l) => l.active);
    return NextResponse.json({ links: filtered, demo: true });
  }
}

export async function POST(request: Request) {
  let body: { label?: string; url?: string; icon?: string; sortOrder?: number } = {};

  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_QUICKLINKS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    body = await request.json();
    const { label, url, icon, sortOrder } = body;

    if (!label || !url) {
      return NextResponse.json({ error: "Label and URL are required" }, { status: 400 });
    }

    const link = await prisma.quickLink.create({
      data: {
        label,
        url,
        icon: icon || "link",
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    console.error("[QuickLinks API] POST error (demo fallback):", error);
    const mockLink = {
      id: `ql-${Date.now()}`,
      label: body.label || "New Link",
      url: body.url || "#",
      icon: body.icon || "link",
      sortOrder: body.sortOrder ?? demoLinks.length,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    demoLinks.push(mockLink);
    return NextResponse.json({ link: mockLink, demo: true }, { status: 201 });
  }
}

export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_QUICKLINKS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, label, url, icon, sortOrder, active } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Demo fallback
    if (id.startsWith("ql-")) {
      const idx = demoLinks.findIndex((l) => l.id === id);
      if (idx !== -1) {
        if (label !== undefined) demoLinks[idx].label = label;
        if (url !== undefined) demoLinks[idx].url = url;
        if (icon !== undefined) demoLinks[idx].icon = icon;
        if (sortOrder !== undefined) demoLinks[idx].sortOrder = sortOrder;
        if (active !== undefined) demoLinks[idx].active = active;
        demoLinks[idx].updatedAt = new Date().toISOString();
        return NextResponse.json({ link: demoLinks[idx], demo: true });
      }
    }

    const link = await prisma.quickLink.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(url !== undefined && { url }),
        ...(icon !== undefined && { icon }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(active !== undefined && { active }),
      },
    });

    return NextResponse.json({ link });
  } catch (error) {
    console.error("[QuickLinks API] PUT error:", error);
    return NextResponse.json({ error: "Failed to update link" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_QUICKLINKS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Demo fallback
    if (id.startsWith("ql-")) {
      const idx = demoLinks.findIndex((l) => l.id === id);
      if (idx !== -1) demoLinks.splice(idx, 1);
      return NextResponse.json({ success: true, demo: true });
    }

    await prisma.quickLink.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[QuickLinks API] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete link" }, { status: 500 });
  }
}
