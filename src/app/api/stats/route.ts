// ProConnect — Stats API Route
// Aggregates counts from local holidays DB, alerts, kudos, and directory
// Returns all 4 stat card values in a single response

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getUpcomingHolidayCount(): Promise<number> {
  try {
    const today = new Date().toISOString().split("T")[0];
    return await prisma.holiday.count({
      where: { visible: true, date: { gte: today } },
    });
  } catch {
    return 0;
  }
}

async function getActiveAlertCount(): Promise<number> {
  try {
    const count = await prisma.alert.count({ where: { active: true } });
    return count || 5; // fallback to demo count
  } catch {
    return 5;
  }
}

async function getKudosThisMonthCount(): Promise<number> {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const count = await prisma.kudosMessage.count({
      where: { createdAt: { gte: startOfMonth } },
    });
    return count || 5; // fallback to demo count
  } catch {
    return 5;
  }
}

async function getTeamMemberCount(): Promise<number> {
  // Try Graph API first, then local DB, then directory API demo data
  try {
    // Use our own directory endpoint which has demo fallback
    const baseUrl = process.env.LOGTO_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/directory?count=true`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.count > 0) return data.count;
    }
  } catch {
    // ignore
  }

  // Fallback: try Prisma user count
  try {
    const count = await prisma.user.count();
    return count || 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  // Fetch all stats in parallel for speed
  const [upcomingHolidays, activeAlerts, kudosThisMonth, teamMembers] =
    await Promise.all([
      getUpcomingHolidayCount(),
      getActiveAlertCount(),
      getKudosThisMonthCount(),
      getTeamMemberCount(),
    ]);

  return NextResponse.json({
    upcomingHolidays,
    teamMembers,
    activeAlerts,
    kudosThisMonth,
  });
}
