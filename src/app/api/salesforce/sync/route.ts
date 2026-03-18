// ProConnect — Salesforce Sync Webhook
// Receives upsert/delete payloads from Salesforce Flow → Apex callout

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timingSafeEqual } from "crypto";

const SECRET = process.env.SALESFORCE_SECRET ?? "";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: Request) {
  console.log("[SF Sync] ← Incoming request received");

  // ── Auth ─────────────────────────────────────────────
  const headerSecret = request.headers.get("x-sf-secret") ?? "";
  console.log("[SF Sync] Secret present in header:", !!headerSecret);
  console.log("[SF Sync] Secret present in env:", !!SECRET);
  if (!safeEqual(headerSecret, SECRET)) {
    console.log("[SF Sync] ✗ Auth failed — secret mismatch");
    return unauthorized();
  }
  console.log("[SF Sync] ✓ Auth passed");

  // ── Parse body ───────────────────────────────────────
  let body: { action?: string; record?: Record<string, unknown> };
  try {
    body = await request.json();
    console.log("[SF Sync] Body:", JSON.stringify(body));
  } catch {
    console.log("[SF Sync] ✗ Invalid JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = (body.action ?? "").toUpperCase();
  const record = body.record;

  if (!record || typeof record !== "object" || !record.id || !record.email) {
    const missing = [!record?.id && "id", !record?.email && "email"].filter(Boolean);
    console.log(`[SF Sync] ✗ Missing required fields: ${missing.join(", ")}`, JSON.stringify(record));
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const id = String(record.id);
  const email = String(record.email).toLowerCase().trim();

  // ── UPSERT ───────────────────────────────────────────
  if (action === "UPSERT") {
    const birthday =
      record.birthday && record.birthday !== "null"
        ? new Date(String(record.birthday))
        : null;
    const employmentStartDate =
      record.employmentStartDate && record.employmentStartDate !== "null"
        ? new Date(String(record.employmentStartDate))
        : null;

    const result = await prisma.salesforceDirectory.upsert({
      where: { id },
      create: {
        id,
        email,
        birthday,
        employmentStartDate,
      },
      update: {
        email,
        birthday,
        employmentStartDate,
        syncedAt: new Date(),
      },
    });

    console.log(`[SF Sync] UPSERT ${id} (${email})`);
    return NextResponse.json({ ok: true, action: "UPSERT", id: result.id });
  }

  // ── DELETE ───────────────────────────────────────────
  if (action === "DELETE") {
    try {
      // Delete related exam_pass_records first (FK constraint)
      await prisma.examPassRecord.deleteMany({ where: { email } });

      // Try delete by id first, fall back to email
      const existing = await prisma.salesforceDirectory.findFirst({
        where: { OR: [{ id }, { email }] },
        select: { id: true },
      });

      if (existing) {
        await prisma.salesforceDirectory.delete({ where: { id: existing.id } });
        console.log(`[SF Sync] DELETE ${existing.id} (${email})`);
        return NextResponse.json({ ok: true, action: "DELETE", id: existing.id });
      }

      return NextResponse.json({ ok: true, action: "DELETE", id, note: "not found" });
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === "P2025") {
        return NextResponse.json({ ok: true, action: "DELETE", id, note: "not found" });
      }
      throw err;
    }
  }

  return NextResponse.json(
    { error: `Unknown action: ${action}. Expected UPSERT or DELETE.` },
    { status: 400 },
  );
}
