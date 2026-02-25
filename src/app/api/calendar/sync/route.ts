// ProConnect — Calendar Sync API Route
// Fetches holidays from configured external APIs and upserts into local DB
// Supports: Nager.Date, Calendarific, Abstract, and custom APIs
//THIS IS MARTINS MESSAGE

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── Types ────────────────────────────────────────────────
interface HolidayApiConfig {
  id: string;
  name: string;
  enabled: boolean;
  type: "nager" | "calendarific" | "abstract" | "custom";
  endpoint: string;
  apiKey?: string;
  country: string;
  color: string;
  category: string;
  typeFilter?: string;
  dateField?: string;
  titleField?: string;
  responsePathToHolidays?: string;
}

interface SyncOptions {
  force?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  federal: "#1e40af",
  fun: "#16a34a",
  company: "#06427F",
};

const ABSTRACT_SYNC_STATE_KEY = "abstract_sync_state";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAbstractSyncState(): Promise<Record<string, boolean>> {
  try {
    const setting = await prisma.calendarSetting.findUnique({ where: { id: ABSTRACT_SYNC_STATE_KEY } });
    if (!setting?.data) return {};
    const parsed = JSON.parse(setting.data) as Record<string, boolean>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function markAbstractYearSeeded(sourceId: string, year: number): Promise<void> {
  const state = await getAbstractSyncState();
  state[`${sourceId}:${year}`] = true;

  await prisma.calendarSetting.upsert({
    where: { id: ABSTRACT_SYNC_STATE_KEY },
    update: { data: JSON.stringify(state) },
    create: { id: ABSTRACT_SYNC_STATE_KEY, data: JSON.stringify(state) },
  });
}

async function getApiConfigs(): Promise<HolidayApiConfig[]> {
  try {
    const setting = await prisma.calendarSetting.findUnique({ where: { id: "holiday_api_configs" } });
    if (setting) return JSON.parse(setting.data) as HolidayApiConfig[];
  } catch {
    // fall through
  }
  return [
    {
      id: "nager-us",
      name: "Nager.Date (US Federal)",
      enabled: true,
      type: "nager",
      endpoint: "https://date.nager.at/api/v3",
      country: "US",
      color: "#1e40af",
      category: "federal",
    },
  ];
}

// ── Nager.Date sync ──────────────────────────────────────
async function syncNager(config: HolidayApiConfig, year: number): Promise<number> {
  const resp = await fetch(`${config.endpoint}/PublicHolidays/${year}/${config.country}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Nager API returned ${resp.status}`);
  const holidays: { date: string; name: string }[] = await resp.json();
  let count = 0;
  for (const h of holidays) {
    const existing = await prisma.holiday.findFirst({
      where: { title: h.name, date: h.date, source: config.id },
    });
    if (!existing) {
      await prisma.holiday.create({
        data: {
          title: h.name,
          date: h.date,
          category: config.category,
          color: config.color || CATEGORY_COLORS[config.category] || "#06427F",
          source: config.id,
          visible: true,
          recurring: false,
        },
      });
      count++;
    }
  }
  return count;
}

// ── Calendarific sync ────────────────────────────────────
async function syncCalendarific(config: HolidayApiConfig, year: number): Promise<number> {
  if (!config.apiKey) throw new Error("No API key configured");
  const params: Record<string, string> = {
    api_key: config.apiKey,
    country: config.country,
    year: year.toString(),
  };
  if (config.typeFilter) params.type = config.typeFilter;
  const qs = new URLSearchParams(params).toString();
  const base = config.endpoint.replace(/\/holidays\/?$/, "");
  const resp = await fetch(`${base}/holidays?${qs}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Calendarific API returned ${resp.status}`);
  const data = await resp.json();
  const holidays = data?.response?.holidays || [];
  let count = 0;
  for (const h of holidays) {
    const dateStr = h.date?.iso?.split("T")[0];
    if (!dateStr) continue;
    const existing = await prisma.holiday.findFirst({
      where: { title: h.name, date: dateStr, source: config.id },
    });
    if (!existing) {
      await prisma.holiday.create({
        data: {
          title: h.name,
          date: dateStr,
          category: config.category,
          color: config.color || CATEGORY_COLORS[config.category] || "#06427F",
          source: config.id,
          visible: true,
          recurring: false,
        },
      });
      count++;
    }
  }
  return count;
}

// ── Abstract API sync ────────────────────────────────────
async function syncAbstract(
  config: HolidayApiConfig,
  year: number,
  options?: SyncOptions
): Promise<number> {
  if (!config.apiKey) throw new Error("No API key configured");

  const force = options?.force === true;
  const state = await getAbstractSyncState();
  if (!force && state[`${config.id}:${year}`]) {
    return 0;
  }

  const base = config.endpoint.replace(/\/+$/, "");
  let count = 0;
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const resp = await fetch(
        `${base}?api_key=${config.apiKey}&country=${config.country}&year=${year}&month=${month}&day=${day}`,
        { signal: AbortSignal.timeout(15000) }
      );

      if (!resp.ok) {
        const payload = await resp.json().catch(() => null);
        const message = payload?.error?.message as string | undefined;
        throw new Error(message ? `Abstract API returned ${resp.status}: ${message}` : `Abstract API returned ${resp.status}`);
      }

      const holidays: { name: string; date?: string; date_year?: string; date_month?: string; date_day?: string }[] =
        await resp.json();

      for (const h of holidays) {
        let dateStr: string;
        if (h.date_year && h.date_month && h.date_day) {
          dateStr = `${h.date_year}-${String(h.date_month).padStart(2, "0")}-${String(h.date_day).padStart(2, "0")}`;
        } else if (h.date) {
          dateStr = h.date;
        } else {
          continue;
        }

        const existing = await prisma.holiday.findFirst({
          where: { title: h.name, date: dateStr, source: config.id },
        });

        if (!existing) {
          await prisma.holiday.create({
            data: {
              title: h.name,
              date: dateStr,
              category: config.category,
              color: config.color || CATEGORY_COLORS[config.category] || "#06427F",
              source: config.id,
              visible: true,
              recurring: false,
            },
          });
          count++;
        }
      }

      await sleep(1100);
    }
  }

  await markAbstractYearSeeded(config.id, year);

  return count;
}

// ── Custom API sync ──────────────────────────────────────
async function syncCustom(config: HolidayApiConfig, year: number): Promise<number> {
  let url = config.endpoint.replace("{year}", year.toString()).replace("{country}", config.country);
  const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`Custom API returned ${resp.status}`);
  let holidays = await resp.json();
  if (config.responsePathToHolidays) {
    for (const p of config.responsePathToHolidays.split(".")) {
      holidays = holidays?.[p];
    }
  }
  if (!Array.isArray(holidays)) return 0;
  const dateField = config.dateField || "date";
  const titleField = config.titleField || "name";
  let count = 0;
  for (const h of holidays) {
    const dateStr = h[dateField];
    const title = h[titleField];
    if (!dateStr || !title) continue;
    const existing = await prisma.holiday.findFirst({
      where: { title, date: dateStr, source: config.id },
    });
    if (!existing) {
      await prisma.holiday.create({
        data: {
          title,
          date: dateStr,
          category: config.category,
          color: config.color || CATEGORY_COLORS[config.category] || "#06427F",
          source: config.id,
          visible: true,
          recurring: false,
        },
      });
      count++;
    }
  }
  return count;
}

// ── Sync dispatcher ──────────────────────────────────────
async function syncFromApi(config: HolidayApiConfig, year: number, options?: SyncOptions): Promise<number> {
  switch (config.type) {
    case "nager": return syncNager(config, year);
    case "calendarific": return syncCalendarific(config, year);
    case "abstract": return syncAbstract(config, year, options);
    case "custom": return syncCustom(config, year);
    default: return 0;
  }
}

// ── Recurring holidays ───────────────────────────────────
async function syncRecurring(year: number): Promise<number> {
  const recurring = await prisma.holiday.findMany({ where: { recurring: true } });
  let count = 0;
  for (const h of recurring) {
    const [, month, day] = h.date.split("-");
    const newDate = `${year}-${month}-${day}`;
    const existing = await prisma.holiday.findFirst({ where: { title: h.title, date: newDate } });
    if (!existing) {
      await prisma.holiday.create({
        data: {
          title: h.title,
          date: newDate,
          category: h.category,
          color: h.color,
          source: h.source,
          visible: h.visible,
          recurring: true,
        },
      });
      count++;
    }
  }
  return count;
}

// ── POST — trigger sync ─────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const baseYear = Number(body.year) || new Date().getFullYear();
    const yearsToSync = Math.min(Math.max(Number(body.years) || 2, 1), 5);
    const years = Array.from({ length: yearsToSync }, (_, i) => baseYear + i);
    const specificApiId = body.apiId; // Optional: sync only one API
    const force = body.force === true;

    const configs = await getApiConfigs();
    const enabledConfigs = specificApiId
      ? configs.filter((c) => c.id === specificApiId)
      : configs.filter((c) => c.enabled);

    const details: Record<string, number> = {};
    const detailsByYear: Record<string, Record<string, number>> = {};
    const errors: string[] = [];
    let total = 0;

    for (const config of enabledConfigs) {
      detailsByYear[config.id] = {};
      let apiTotal = 0;

      for (const year of years) {
        try {
          const count = await syncFromApi(config, year, { force });
          detailsByYear[config.id][year.toString()] = count;
          apiTotal += count;
          total += count;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          errors.push(`${config.name} (${year}): ${msg}`);
          detailsByYear[config.id][year.toString()] = 0;
        }
      }

      details[config.id] = apiTotal;

      await prisma.calendarSyncLog.create({
        data: {
          source: config.id,
          status: Object.values(detailsByYear[config.id]).some((v) => v > 0) ? "success" : "error",
          message: `Synced ${apiTotal} holidays across ${years.join(", ")}`,
        },
      });
    }

    // Sync recurring
    let recurring = 0;
    for (const year of years) {
      recurring += await syncRecurring(year);
    }

    return NextResponse.json({
      message: "Sync completed",
      synced: { total, recurring, details, detailsByYear, years },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Calendar Sync] Error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

// ── GET — sync logs ─────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const logs = await prisma.calendarSyncLog.findMany({
      orderBy: { syncedAt: "desc" },
      take: limit,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("[Calendar Sync] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch sync logs" }, { status: 500 });
  }
}

// ── DELETE — clear sync logs ────────────────────────────
export async function DELETE() {
  try {
    const result = await prisma.calendarSyncLog.deleteMany({});
    return NextResponse.json({ message: `Cleared ${result.count} sync logs` });
  } catch (error) {
    console.error("[Calendar Sync] DELETE error:", error);
    return NextResponse.json({ error: "Failed to clear logs" }, { status: 500 });
  }
}
