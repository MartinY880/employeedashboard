// ProConnect — Calendar Settings API Route
// Manages: category labels, holiday API configurations, SMTP settings

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── GET — Read settings ────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    // Single key
    if (key) {
      const setting = await prisma.calendarSetting.findUnique({ where: { id: key } });
      if (!setting) return NextResponse.json(getDefault(key));
      try {
        return NextResponse.json(JSON.parse(setting.data));
      } catch {
        return NextResponse.json({ value: setting.data });
      }
    }

    // All settings
    const settings = await prisma.calendarSetting.findMany();
    const result: Record<string, unknown> = {};
    for (const s of settings) {
      try { result[s.id] = JSON.parse(s.data); } catch { result[s.id] = s.data; }
    }
    return NextResponse.json({ ...getDefaults(), ...result });
  } catch (error) {
    console.error("[Calendar Settings] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// ── PUT — Upsert a setting ─────────────────────────────────
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    const data = typeof value === "string" ? value : JSON.stringify(value);

    await prisma.calendarSetting.upsert({
      where: { id: key },
      update: { data },
      create: { id: key, data },
    });

    return NextResponse.json({ message: "Setting saved", key });
  } catch (error) {
    console.error("[Calendar Settings] PUT error:", error);
    return NextResponse.json({ error: "Failed to save setting" }, { status: 500 });
  }
}

// ── Defaults ───────────────────────────────────────────────

function getDefault(key: string): unknown {
  const defaults = getDefaults();
  return defaults[key] ?? {};
}

function getDefaults(): Record<string, unknown> {
  return {
    category_labels: { federal: "Federal", fun: "Fun", company: "Company" },
    category_colors: { federal: "#1e40af", fun: "#16a34a", company: "#06427F" },
    holiday_api_configs: [
      {
        id: "nager-us",
        name: "Nager.Date (US Federal)",
        enabled: true,
        type: "nager",
        endpoint: "https://date.nager.at/api/v3",
        apiKey: "",
        country: "US",
        color: "#1e40af",
        category: "federal",
        typeFilter: "",
      },
      {
        id: "calendarific-us",
        name: "Calendarific (Fun/Observance)",
        enabled: false,
        type: "calendarific",
        endpoint: "https://calendarific.com/api/v2",
        apiKey: "",
        country: "US",
        color: "#16a34a",
        category: "fun",
        typeFilter: "observance",
      },
    ],
    smtp_settings: {
      host: "",
      port: "587",
      user: "",
      pass: "",
      from: "",
      fromName: "ProConnect Calendar",
    },
  };
}
