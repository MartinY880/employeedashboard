// ProConnect — Timezone State Visibility API
// GET: returns a map of state name → visible (true/false)
// PATCH: updates state visibility (admin only)
// States not present in the saved data default to visible on the widget.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";

const SETTING_ID = "timezone_state_visibility";

export async function GET() {
  try {
    const row = await prisma.calendarSetting.findUnique({
      where: { id: SETTING_ID },
    });

    if (row?.data) {
      try {
        const parsed = JSON.parse(row.data) as Record<string, boolean>;
        return NextResponse.json(parsed);
      } catch {
        /* fall through to empty default */
      }
    }

    return NextResponse.json({});
  } catch {
    return NextResponse.json({});
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated } = await getAuthUser();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json() as Record<string, boolean>;

    // Validate: only boolean values allowed
    const sanitized: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(body)) {
      if (typeof val === "boolean") {
        sanitized[key] = val;
      }
    }

    await prisma.calendarSetting.upsert({
      where: { id: SETTING_ID },
      update: { data: JSON.stringify(sanitized) },
      create: { id: SETTING_ID, data: JSON.stringify(sanitized) },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
