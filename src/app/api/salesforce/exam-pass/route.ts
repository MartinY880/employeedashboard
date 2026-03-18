// ProConnect — Salesforce Exam Pass Webhook
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
  console.log("[SF ExamPass] ← Incoming request received");

  // ── Auth ─────────────────────────────────────────────
  const headerSecret = request.headers.get("x-sf-secret") ?? "";
  if (!safeEqual(headerSecret, SECRET)) {
    console.log("[SF ExamPass] ✗ Auth failed — secret mismatch");
    return unauthorized();
  }
  console.log("[SF ExamPass] ✓ Auth passed");

  // ── Parse body ───────────────────────────────────────
  let body: { action?: string; record?: Record<string, unknown> };
  try {
    body = await request.json();
    console.log("[SF ExamPass] Body:", JSON.stringify(body));
  } catch {
    console.log("[SF ExamPass] ✗ Invalid JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = (body.action ?? "").toUpperCase();
  const record = body.record;

  if (!record || typeof record !== "object" || !record.email) {
    console.log("[SF ExamPass] ✗ Missing required field: email", JSON.stringify(record));
    return NextResponse.json(
      { error: "Missing required field: email" },
      { status: 400 },
    );
  }

  const email = String(record.email).toLowerCase().trim();

  // ── UPSERT ───────────────────────────────────────────
  if (action === "UPSERT") {
    // Look up the employee name from the directory
    const employee = await prisma.salesforceDirectory.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!employee) {
      console.log(`[SF ExamPass] ✗ No directory entry for ${email}`);
      return NextResponse.json(
        { error: `No directory entry found for email: ${email}` },
        { status: 404 },
      );
    }

    // Fetch employee name from the Entra directory snapshot
    const directory = await prisma.directorySnapshot.findFirst({
      where: { mail: { equals: email, mode: "insensitive" } },
      select: { displayName: true },
    });

    const employeeName = directory?.displayName ?? email;

    const result = await prisma.examPassRecord.upsert({
      where: { email },
      create: {
        email,
        employeeName,
      },
      update: {
        employeeName,
      },
    });

    console.log(`[SF ExamPass] UPSERT ${email} (${employeeName})`);
    return NextResponse.json({ ok: true, action: "UPSERT", id: result.id });
  }

  // ── DELETE ───────────────────────────────────────────
  if (action === "DELETE") {
    try {
      await prisma.examPassRecord.delete({ where: { email } });
      console.log(`[SF ExamPass] DELETE ${email}`);
      return NextResponse.json({ ok: true, action: "DELETE", email });
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === "P2025") {
        return NextResponse.json({ ok: true, action: "DELETE", email, note: "not found" });
      }
      throw err;
    }
  }

  return NextResponse.json(
    { error: `Unknown action: ${action}. Expected UPSERT or DELETE.` },
    { status: 400 },
  );
}
