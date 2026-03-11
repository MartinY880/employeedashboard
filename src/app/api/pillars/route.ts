// ProConnect — Pillars API Route
// GET: Fetch all pillars + header + v2 data | PUT: Replace all pillars (admin)
// PATCH: Update pillar header only
// Storage: PostgreSQL via calendar_settings table (JSON blobs)

import { NextResponse } from "next/server";
import type { PillarData, PillarHeader, PillarV2Data } from "@/lib/pillar-icons";
import { DEFAULT_PILLAR_V2 } from "@/lib/pillar-icons";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const DB_KEY_PILLARS = "pillars_data";
const DB_KEY_HEADER = "pillars_header";
const DB_KEY_V2 = "pillars_v2";

const DEFAULT_PILLARS: PillarData[] = [
  { id: "p1", icon: "Shield", title: "Integrity", message: "We act with honesty and transparency in everything we do." },
  { id: "p2", icon: "Target", title: "Accountability", message: "We own our results and deliver on our commitments." },
  { id: "p3", icon: "Users", title: "Teamwork", message: "We collaborate and support each other to achieve more." },
  { id: "p4", icon: "Lightbulb", title: "Innovation", message: "We embrace new ideas and continuously improve." },
  { id: "p5", icon: "HeartHandshake", title: "Service", message: "We put our clients and community at the center of our work." },
  { id: "p6", icon: "TrendingUp", title: "Excellence", message: "We strive for the highest standard in everything we do." },
];

const DEFAULT_HEADER: PillarHeader = {
  title: "OUR COMPANY PILLARS",
  subtitle: "The core values that drive everything we do at MortgagePros",
  maxWidth: 1100,
};

async function loadPillars(): Promise<PillarData[]> {
  try {
    const row = await prisma.calendarSetting.findUnique({ where: { id: DB_KEY_PILLARS } });
    if (row?.data) return JSON.parse(row.data);
    return DEFAULT_PILLARS;
  } catch {
    return DEFAULT_PILLARS;
  }
}

async function loadHeader(): Promise<PillarHeader> {
  try {
    const row = await prisma.calendarSetting.findUnique({ where: { id: DB_KEY_HEADER } });
    if (row?.data) return JSON.parse(row.data);
    return DEFAULT_HEADER;
  } catch {
    return DEFAULT_HEADER;
  }
}

async function loadV2(): Promise<PillarV2Data> {
  try {
    const row = await prisma.calendarSetting.findUnique({ where: { id: DB_KEY_V2 } });
    if (row?.data) return JSON.parse(row.data);
    return DEFAULT_PILLAR_V2;
  } catch {
    return DEFAULT_PILLAR_V2;
  }
}

async function savePillars(pillars: PillarData[]): Promise<void> {
  await prisma.calendarSetting.upsert({
    where: { id: DB_KEY_PILLARS },
    update: { data: JSON.stringify(pillars) },
    create: { id: DB_KEY_PILLARS, data: JSON.stringify(pillars) },
  });
}

async function saveHeader(header: PillarHeader): Promise<void> {
  await prisma.calendarSetting.upsert({
    where: { id: DB_KEY_HEADER },
    update: { data: JSON.stringify(header) },
    create: { id: DB_KEY_HEADER, data: JSON.stringify(header) },
  });
}

async function saveV2(data: PillarV2Data): Promise<void> {
  await prisma.calendarSetting.upsert({
    where: { id: DB_KEY_V2 },
    update: { data: JSON.stringify(data) },
    create: { id: DB_KEY_V2, data: JSON.stringify(data) },
  });
}

export async function GET() {
  const [pillars, header, v2] = await Promise.all([loadPillars(), loadHeader(), loadV2()]);
  return NextResponse.json({ pillars, header, v2 });
}

export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_PILLARS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Body must be an array of pillars" }, { status: 400 });
    }

    // Validate each pillar
    for (const p of body) {
      if (!p.id || !p.icon || !p.title || !p.message) {
        return NextResponse.json(
          { error: "Each pillar must have id, icon, title, and message" },
          { status: 400 }
        );
      }
    }

    await savePillars(body);
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "Failed to save pillars" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_PILLARS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, subtitle } = body;

    if (!title || !subtitle) {
      return NextResponse.json({ error: "title and subtitle are required" }, { status: 400 });
    }

    const header: PillarHeader = {
      title,
      subtitle,
      maxWidth: body.maxWidth ?? 1100,
      bannerTitleSize: body.bannerTitleSize ?? 14,
      bannerSubtitleSize: body.bannerSubtitleSize ?? 11,
      cardTitleSize: body.cardTitleSize ?? 14,
      cardMessageSize: body.cardMessageSize ?? 11,
      template: body.template ?? "v1",
    };
    await saveHeader(header);

    // If v2 data is included, save it too
    if (body.v2) {
      await saveV2(body.v2);
    }

    return NextResponse.json(header);
  } catch {
    return NextResponse.json({ error: "Failed to save header" }, { status: 500 });
  }
}
