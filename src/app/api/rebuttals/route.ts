// ProConnect — Rebuttals API
// GET  = current rebuttal (with rotation), POST = create, PUT = update, DELETE = remove

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { getCurrentRebuttal } from "@/lib/rebuttal";

/* ------------------------------------------------------------------ */
/*  GET                                                                */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";

  try {
    if (all) {
      const rebuttals = await prisma.rebuttal.findMany({
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json(rebuttals);
    }

    const current = await getCurrentRebuttal();
    return NextResponse.json(current ?? null);
  } catch {
    return NextResponse.json(null);
  }
}

/* ------------------------------------------------------------------ */
/*  POST                                                               */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const { isAuthenticated, user } = await getAuthUser();
  if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_REBUTTALS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { objection, rebuttal } = body;

  if (!objection?.trim() || !rebuttal?.trim()) {
    return NextResponse.json({ error: "objection and rebuttal are required" }, { status: 400 });
  }

  try {
    const created = await prisma.rebuttal.create({
      data: {
        objection: objection.trim(),
        rebuttal: rebuttal.trim(),
        lastShownAt: new Date(),
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create rebuttal" }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  PUT                                                                */
/* ------------------------------------------------------------------ */

export async function PUT(req: NextRequest) {
  const { isAuthenticated, user } = await getAuthUser();
  if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_REBUTTALS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, ...fields } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (fields.objection !== undefined) data.objection = fields.objection.trim();
  if (fields.rebuttal !== undefined) data.rebuttal = fields.rebuttal.trim();
  if (fields.isActive !== undefined) data.isActive = fields.isActive;

  try {
    const updated = await prisma.rebuttal.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE                                                             */
/* ------------------------------------------------------------------ */

export async function DELETE(req: NextRequest) {
  const { isAuthenticated, user } = await getAuthUser();
  if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_REBUTTALS)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id param is required" }, { status: 400 });
  }

  try {
    await prisma.rebuttal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
