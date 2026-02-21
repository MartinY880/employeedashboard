// ProConnect — Ideas API Route
// GET: Fetch ideas (with optional filters) | POST: Submit new idea
// PATCH: Vote on idea or update status | DELETE: Remove idea (admin)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";

// In-memory store for demo-mode ideas (survives refresh, not server restart)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const demoIdeas: any[] = [
  {
    id: "idea-1",
    title: "Allow flexible work hours on Fridays",
    description: "If we hit our weekly goals, let's allow log-off at 2pm on Fridays during summer months. This would boost morale and reward productivity.",
    authorId: "demo-1",
    authorName: "Sarah Johnson",
    votes: 22,
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "idea-2",
    title: "Better coffee machine in the 3rd floor kitchen",
    description: "The current Keurig is too slow for the morning rush. A bean-to-cup machine would boost morale significantly.",
    authorId: "demo-2",
    authorName: "Mike Torres",
    votes: 18,
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "idea-3",
    title: "Monthly 'Lunch & Learn' sessions",
    description: "Cross-departmental knowledge sharing sessions hosted by employees, with free lunch provided. Great for team building!",
    authorId: "demo-3",
    authorName: "David Lee",
    votes: 12,
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: "idea-4",
    title: "Switch to Asana for project management",
    description: "Jira is becoming too cumbersome for the marketing team's workflow. Asana fits better for our needs.",
    authorId: "demo-4",
    authorName: "Elena Brooks",
    votes: 8,
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
  {
    id: "idea-5",
    title: "Dedicated Slack channel for pet photos",
    description: "We need a dedicated space for wellness and cute animal content. It lifts spirits!",
    authorId: "demo-5",
    authorName: "Jenny Park",
    votes: 4,
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 3600000).toISOString(),
  },
  {
    id: "idea-6",
    title: "Upgrade conference room microphones",
    description: "Remote participants were complaining about audio quality. New Jabra Speak units would fix this.",
    authorId: "demo-6",
    authorName: "IT Department",
    votes: 45,
    status: "SELECTED",
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: "idea-7",
    title: "Add commuter benefits program",
    description: "Pre-tax deduction for public transit now available through Workday. Helps everyone commuting daily.",
    authorId: "demo-7",
    authorName: "HR Team",
    votes: 32,
    status: "SELECTED",
    createdAt: new Date(Date.now() - 21 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
];

let demoIdCounter = 100;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get("count") === "true";
    const status = searchParams.get("status"); // ACTIVE, SELECTED, ARCHIVED, or null for all

    // Try database first
    try {
      const where = status ? { status: status as "ACTIVE" | "SELECTED" | "ARCHIVED" } : {};

      if (countOnly) {
        const count = await prisma.idea.count({ where });
        if (count === 0) {
          let filtered = [...demoIdeas];
          if (status) {
            filtered = filtered.filter((i) => i.status === status);
          }
          return NextResponse.json({ count: filtered.length, demo: true });
        }
        return NextResponse.json({ count });
      }

      const ideas = await prisma.idea.findMany({
        where,
        orderBy: [{ votes: "desc" }, { createdAt: "desc" }],
      });

      // If DB is empty, fall back to demo data
      if (ideas.length === 0) {
        let filtered = [...demoIdeas];
        if (status) {
          filtered = filtered.filter((i) => i.status === status);
        }
        filtered.sort((a, b) => b.votes - a.votes || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return NextResponse.json({ ideas: filtered, demo: true });
      }

      return NextResponse.json({ ideas });
    } catch {
      // Database unavailable — use demo data
      let filtered = [...demoIdeas];
      if (status) {
        filtered = filtered.filter((i) => i.status === status);
      }

      if (countOnly) {
        return NextResponse.json({ count: filtered.length });
      }

      filtered.sort((a, b) => b.votes - a.votes || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return NextResponse.json({ ideas: filtered });
    }
  } catch {
    return NextResponse.json({ ideas: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    const body = await request.json();
    const { title, description, authorName } = body;

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 });
    }

    // Try database first
    try {
      const idea = await prisma.idea.create({
        data: {
          title: title.trim(),
          description: description.trim(),
          authorId: isAuthenticated && user ? user.sub : "anonymous",
          authorName: authorName?.trim() || (isAuthenticated && user ? user.name : "Anonymous"),
        },
      });
      return NextResponse.json({ idea }, { status: 201 });
    } catch {
      // Database unavailable — use demo data
      demoIdCounter++;
      const newIdea = {
        id: `idea-demo-${demoIdCounter}`,
        title: title.trim(),
        description: description.trim(),
        authorId: isAuthenticated && user ? user.sub : "anonymous",
        authorName: authorName?.trim() || (isAuthenticated && user ? user.name : "Anonymous"),
        votes: 0,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      demoIdeas.unshift(newIdea);
      return NextResponse.json({ idea: newIdea }, { status: 201 });
    }
  } catch {
    return NextResponse.json({ error: "Failed to create idea" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, vote, status } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Try database first
    try {
      if (vote === "up" || vote === "down") {
        const idea = await prisma.idea.update({
          where: { id },
          data: { votes: { increment: vote === "up" ? 1 : -1 } },
        });
        return NextResponse.json({ idea });
      }

      if (status) {
        const idea = await prisma.idea.update({
          where: { id },
          data: { status },
        });
        return NextResponse.json({ idea });
      }

      return NextResponse.json({ error: "No valid update provided" }, { status: 400 });
    } catch {
      // Database unavailable — use demo data
      const idea = demoIdeas.find((i) => i.id === id);
      if (!idea) {
        return NextResponse.json({ error: "Idea not found" }, { status: 404 });
      }

      if (vote === "up") idea.votes++;
      if (vote === "down") idea.votes = Math.max(0, idea.votes - 1);
      if (status) idea.status = status;
      idea.updatedAt = new Date().toISOString();

      return NextResponse.json({ idea });
    }
  } catch {
    return NextResponse.json({ error: "Failed to update idea" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Try database first
    try {
      await prisma.idea.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch {
      // Database unavailable — use demo data
      const index = demoIdeas.findIndex((i) => i.id === id);
      if (index === -1) {
        return NextResponse.json({ error: "Idea not found" }, { status: 404 });
      }
      demoIdeas.splice(index, 1);
      return NextResponse.json({ success: true });
    }
  } catch {
    return NextResponse.json({ error: "Failed to delete idea" }, { status: 500 });
  }
}
