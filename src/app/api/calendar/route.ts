// ProConnect — Calendar API Route
// Proxies to MortgagePros Calendar app (Express backend on port 4000)
// Falls back to demo data when calendar service is unavailable

import { NextResponse } from "next/server";

const CALENDAR_API_URL = process.env.CALENDAR_API_URL || "http://localhost:4000";

// Demo holidays in case the calendar service isn't running
const DEMO_HOLIDAYS = [
  { id: 1, title: "Presidents' Day", date: "2026-02-16", category: "federal", visible: true, recurring: true },
  { id: 2, title: "Employee Appreciation Day", date: "2026-03-06", category: "company", visible: true, recurring: true },
  { id: 3, title: "St. Patrick's Day", date: "2026-03-17", category: "fun", visible: true, recurring: true },
  { id: 4, title: "Good Friday", date: "2026-04-03", category: "federal", visible: true, recurring: true },
  { id: 5, title: "Memorial Day", date: "2026-05-25", category: "federal", visible: true, recurring: true },
  { id: 6, title: "Company Summer BBQ", date: "2026-06-19", category: "company", visible: true, recurring: false },
  { id: 7, title: "Independence Day", date: "2026-07-04", category: "federal", visible: true, recurring: true },
  { id: 8, title: "Labor Day", date: "2026-09-07", category: "federal", visible: true, recurring: true },
  { id: 9, title: "Thanksgiving", date: "2026-11-26", category: "federal", visible: true, recurring: true },
  { id: 10, title: "Company Holiday Party", date: "2026-12-18", category: "company", visible: true, recurring: true },
  { id: 11, title: "Christmas Day", date: "2026-12-25", category: "federal", visible: true, recurring: true },
  { id: 12, title: "New Year's Day", date: "2026-01-01", category: "federal", visible: true, recurring: true },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") || new Date().getFullYear().toString();
    const category = searchParams.get("category");

    const params = new URLSearchParams({ year });
    if (category) params.set("category", category);

    const response = await fetch(`${CALENDAR_API_URL}/api/holidays?${params}`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (!response.ok) {
      throw new Error(`Calendar API responded with ${response.status}`);
    }

    const holidays = await response.json();
    return NextResponse.json(holidays);
  } catch (error) {
    console.error("[Calendar Proxy] Error:", error);

    // Fall back to demo data
    let filtered = DEMO_HOLIDAYS.filter((h) => h.visible);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    if (category) {
      filtered = filtered.filter((h) => h.category === category);
    }

    return NextResponse.json(filtered);
  }
}
