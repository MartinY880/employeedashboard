// ProConnect — OOO Forwarding Cron API Route
// Manual trigger endpoint. The same logic also runs automatically
// via the instrumentation hook (setInterval every 60s).
//
// Activate: PENDING schedules whose startsAt <= now
// Deactivate: ACTIVE schedules whose endsAt <= now

import { NextRequest, NextResponse } from "next/server";
import { processForwardingSchedules } from "@/lib/forwarding-scheduler";

// Protect the cron endpoint with a secret token
const CRON_SECRET = process.env.CRON_SECRET || "";

function isAuthorized(request: NextRequest): boolean {
  // Allow in development without a secret
  if (!CRON_SECRET && process.env.NODE_ENV === "development") return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${CRON_SECRET}`) return true;

  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") === CRON_SECRET) return true;

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processForwardingSchedules();

  return NextResponse.json({
    activated: result.activated,
    deactivated: result.deactivated,
    missed: result.missed,
    errors: result.errors.length > 0 ? result.errors : undefined,
  });
}
