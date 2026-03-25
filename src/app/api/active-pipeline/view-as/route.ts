// ProConnect — Active Pipeline: View As User
// POST → Set impersonation: admin views dashboard as a specific user
// GET  → Check current impersonation state
// DELETE → Clear impersonation

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const VIEW_AS_PREFIX = "pipeline_viewas_";

interface ViewAsData {
  name: string;
  email: string;
  roles?: string[];
  setAt: string;
}

/** POST — set impersonation for the current admin */
export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_ACTIVE_PIPELINE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const roles = Array.isArray(body.roles) ? body.roles.map(String).filter(Boolean) : [];

    if (!name && !email) {
      return NextResponse.json({ error: "name or email is required" }, { status: 400 });
    }

    const viewAsId = `${VIEW_AS_PREFIX}${user.sub}`;
    const data: ViewAsData = { name, email, roles, setAt: new Date().toISOString() };

    await prisma.calendarSetting.upsert({
      where: { id: viewAsId },
      create: { id: viewAsId, data: JSON.stringify(data) },
      update: { data: JSON.stringify(data) },
    });

    return NextResponse.json({ ok: true, viewingAs: data });
  } catch (err) {
    console.error("[Pipeline] View-as POST error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** GET — check current impersonation state */
export async function GET() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const viewAsId = `${VIEW_AS_PREFIX}${user.sub}`;
    const row = await prisma.calendarSetting.findUnique({ where: { id: viewAsId } });

    if (!row?.data) {
      return NextResponse.json({ viewingAs: null });
    }

    try {
      const data: ViewAsData = JSON.parse(row.data);
      return NextResponse.json({ viewingAs: data });
    } catch {
      return NextResponse.json({ viewingAs: null });
    }
  } catch (err) {
    console.error("[Pipeline] View-as GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** DELETE — clear impersonation */
export async function DELETE() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_ACTIVE_PIPELINE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const viewAsId = `${VIEW_AS_PREFIX}${user.sub}`;
    await prisma.calendarSetting.deleteMany({ where: { id: viewAsId } });

    return NextResponse.json({ ok: true, viewingAs: null });
  } catch (err) {
    console.error("[Pipeline] View-as DELETE error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
