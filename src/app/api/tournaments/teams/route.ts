// ProConnect — Tournament Teams API
// POST: Add team | DELETE: Remove team

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_TOURNAMENT)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { tournamentId, player1Name, player2Name, division, seed } = body;

    if (!tournamentId || !player1Name?.trim() || !player2Name?.trim() || !division) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    try {
      const team = await prisma.tournamentTeam.create({
        data: {
          tournamentId,
          player1Name: player1Name.trim(),
          player2Name: player2Name.trim(),
          division,
          seed: seed ?? 0,
        },
      });
      return NextResponse.json({ team }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_TOURNAMENT)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
    }

    try {
      await prisma.tournamentTeam.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Failed to delete team" }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: "Failed to delete team" }, { status: 500 });
  }
}
