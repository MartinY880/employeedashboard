// ProConnect — Stats API Route
// Aggregates counts from calendar proxy, alerts, kudos, and directory
// Returns all 4 stat card values in a single response

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CALENDAR_API_URL = process.env.CALENDAR_API_URL || "http://localhost:4000";

async function getUpcomingHolidayCount(): Promise<number> {
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const year = new Date().getFullYear().toString();

    const response = await fetch(`${CALENDAR_API_URL}/api/holidays?year=${year}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return 0;

    const holidays: { date: string; visible: boolean }[] = await response.json();
    // Count holidays from today onwards
    return holidays.filter((h) => h.date >= today).length;
  } catch {
    // Calendar service may not be running — return 0
    return 0;
  }
}

async function getActiveAlertCount(): Promise<number> {
  try {
    return await prisma.alert.count({ where: { active: true } });
  } catch {
    return 0;
  }
}

async function getKudosThisMonthCount(): Promise<number> {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return await prisma.kudosMessage.count({
      where: { createdAt: { gte: startOfMonth } },
    });
  } catch {
    return 0;
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
