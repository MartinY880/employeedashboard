// ProConnect — Pillars API Route
// GET: Fetch all pillars | PUT: Replace all pillars (admin)

import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { PillarData } from "@/lib/pillar-icons";

const DATA_DIR = join(process.cwd(), "src", "data");
const PILLARS_FILE = join(DATA_DIR, "pillars.json");

const DEFAULT_PILLARS: PillarData[] = [
  { id: "p1", icon: "Shield", title: "Integrity", message: "We act with honesty and transparency in everything we do." },
  { id: "p2", icon: "Target", title: "Accountability", message: "We own our results and deliver on our commitments." },
  { id: "p3", icon: "Users", title: "Teamwork", message: "We collaborate and support each other to achieve more." },
  { id: "p4", icon: "Lightbulb", title: "Innovation", message: "We embrace new ideas and continuously improve." },
  { id: "p5", icon: "HeartHandshake", title: "Service", message: "We put our clients and community at the center of our work." },
  { id: "p6", icon: "TrendingUp", title: "Excellence", message: "We strive for the highest standard in everything we do." },
];

async function loadPillars(): Promise<PillarData[]> {
  try {
    const raw = await readFile(PILLARS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return DEFAULT_PILLARS;
  }
}

async function savePillars(pillars: PillarData[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(PILLARS_FILE, JSON.stringify(pillars, null, 2), "utf-8");
}

export async function GET() {
  const pillars = await loadPillars();
  return NextResponse.json(pillars);
}

export async function PUT(request: Request) {
  try {
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
