// ProConnect — Tournaments API Route
// GET: Fetch tournaments | POST: Create tournament
// PATCH: Update tournament | DELETE: Remove tournament

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";

// ─── Demo Data ─────────────────────────────────────────────

interface DemoTeam {
  id: string;
  tournamentId: string;
  player1Name: string;
  player2Name: string;
  seed: number;
  division: string;
  createdAt: string;
}

interface DemoMatch {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  division: string;
  team1Id: string | null;
  team2Id: string | null;
  team1: DemoTeam | null;
  team2: DemoTeam | null;
  winnerId: string | null;
  winner: DemoTeam | null;
  team1Score: number | null;
  team2Score: number | null;
  status: string;
  nextMatchId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DemoTournament {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  teams: DemoTeam[];
  matches: DemoMatch[];
}

function buildDemoData(): DemoTournament[] {
  const now = new Date().toISOString();
  const tournamentId = "demo-tournament-1";

  // Region 1 teams
  const region1Teams: [string, string][] = [
    ["Parsa Afshar", "Martin Palaj"],
    ["Angelo Elias", "Catherine Jehl"],
    ["Karl Austin", "Andrew Carlisle"],
    ["Bria Jackson", "DJ Noonkester"],
    ["Remy Ibrahim", "Tyler VanDenBrouck"],
    ["Max Baumgarten", "Charles Ryle"],
    ["Ivan Bahnam", "Rodney Moody Jr"],
    ["Rylan Putrus", "Joe Nowak"],
    ["Izabella Ljacaj", "David Burnette"],
    ["Samir Rahman", "Prince Dobbins"],
    ["Julius Stoutermire", "Mateo Rubio"],
    ["Latonya Maclin", "Revan Albajalan"],
    ["John Kassab", "Bryan Sawyer"],
    ["Avianca Dalou", "Jerry Russell"],
    ["Simon Mansour", "Adel Ibrahim"],
  ];

  // Region 2 teams
  const region2Teams: [string, string][] = [
    ["Taylor Cooper", "Zaid Shuwayhat"],
    ["Libby VanLear", "April Clarke"],
    ["Paul Etta", "Ben Meso"],
    ["Alejandro Villalta", "Darren Ingels"],
    ["Karl Chidiac", "Devin Bahnam"],
    ["Adam Ali", "Vladislav Sheyngauz"],
    ["Malcomb Baker", "Lucas Rohr"],
    ["John Karim", "Kyle Peters"],
    ["Matt Tomsett", "Anthony Hakop"],
    ["Rivan Hanna", "Nathaniel Salmo"],
    ["Jeremy Long", "Katrina Bullock"],
    ["Christian Boji", "Zachary Shier"],
    ["Cayden Stoltz", "Nick Wellman"],
    ["Sam Pokorney", "Steven Clark"],
    ["Liv Diehl", "David Prifti"],
    ["Gerard Tate", "Damien Montgomery"],
  ];

  // Region 3 teams
  const region3Teams: [string, string][] = [
    ["Androu Soliman", "Julian Guzman"],
    ["Allen Toma", "Mario Mikhail"],
    ["Adam Flake", "David Mujaj"],
    ["Donovan Anderson", "Enrico Raciti"],
    ["Joseph Bahi", "Brennan Coleman"],
    ["Franklin Tuaimeh", "Adnan Ibranovic"],
    ["Fadi Ramzi", "Melissa Barraza"],
    ["Lance Gauthier", "Mason Dixon"],
    ["Jesse MacMillan", "Angelo Jarjes"],
    ["Caleb Patterson", "Kevin Pelkey"],
    ["Mandy Fields", "Rachel Raney"],
    ["Melanie Rayis", "Jacob Pflaum"],
    ["Angelo Nannoshi", "Franklin Stinnett"],
    ["Donivan Dickerson", "Devin Freeze"],
    ["Asher Sheriff", "James Anglin"],
    ["Jonah Hepner", "Raphael Rayner"],
  ];

  // Region 4 teams
  const region4Teams: [string, string][] = [
    ["Patrick Soumo", "Kyle Yousif"],
    ["Travis Tsurui", "Zaan Strasser"],
    ["Saher Mekhaail", "Sam Sarkar"],
    ["Nishath Sultana", "Drake Najor"],
    ["Driton Gjokaj", "Antonio Hayes"],
    ["Antonio Kirovski", "Jack Johnson"],
    ["Christian Bally", "Bianca Payton"],
    ["Ryan Beauchamp", "Andrew Schapman"],
    ["Michael Gorges", "Tiana Reed"],
    ["Jack Szczepanik", "Patrick Habbouche"],
    ["Joe Gappy", "LaMonte Stinnette"],
    ["Savio Senawi", "Tae Yi"],
    ["Shelby Hanika", "Andrea Lowe"],
    ["Andrew Garmo", "Brandon Delly"],
    ["Stefan Plumaj", "Stephanie Boji"],
    ["Armaan Mundian", "Raquel Namo"],
  ];

  const divisions: { name: string; teams: [string, string][] }[] = [
    { name: "Region 1", teams: region1Teams },
    { name: "Region 2", teams: region2Teams },
    { name: "Region 3", teams: region3Teams },
    { name: "Region 4", teams: region4Teams },
  ];

  const allTeams: DemoTeam[] = [];
  const allMatches: DemoMatch[] = [];

  let teamCounter = 0;
  let matchCounter = 0;

  for (const div of divisions) {
    const divTeams: DemoTeam[] = [];
    for (let i = 0; i < div.teams.length; i++) {
      teamCounter++;
      divTeams.push({
        id: `demo-team-${teamCounter}`,
        tournamentId,
        player1Name: div.teams[i][0],
        player2Name: div.teams[i][1],
        seed: i + 1,
        division: div.name,
        createdAt: now,
      });
    }
    allTeams.push(...divTeams);

    // Build round 1 matches for this division
    // Region 1 has 15 teams (match 1 is BYE), others have 16
    const matchups: [number, number | null][] = [];
    if (div.name === "Region 1") {
      // BYE WEEK for first team — they auto-advance
      matchups.push([0, -1]); // -1 signals BYE
      for (let i = 1; i < 15; i += 2) {
        matchups.push([i, i + 1]);
      }
    } else {
      for (let i = 0; i < div.teams.length; i += 2) {
        matchups.push([i, i + 1]);
      }
    }

    for (let i = 0; i < matchups.length; i++) {
      matchCounter++;
      const [t1Idx, t2Idx] = matchups[i];
      const isBye = t2Idx === -1;

      const team1 = divTeams[t1Idx];
      const team2 = isBye ? null : divTeams[t2Idx!];

      allMatches.push({
        id: `demo-match-${matchCounter}`,
        tournamentId,
        round: 1,
        matchNumber: i + 1,
        division: div.name,
        team1Id: team1.id,
        team2Id: team2?.id || null,
        team1,
        team2,
        winnerId: isBye ? team1.id : null,
        winner: isBye ? team1 : null,
        team1Score: null,
        team2Score: null,
        status: isBye ? "COMPLETED" : "PENDING",
        nextMatchId: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return [
    {
      id: tournamentId,
      name: "MortgagePros 2026 Tournament",
      description: "Company-wide 2-person team tournament across 4 divisions",
      status: "IN_PROGRESS",
      createdAt: now,
      updatedAt: now,
      teams: allTeams,
      matches: allMatches,
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let demoTournaments: DemoTournament[] | null = null;

function getDemoData(): DemoTournament[] {
  if (!demoTournaments) {
    demoTournaments = buildDemoData();
  }
  return demoTournaments;
}

let demoIdCounter = 1000;

// ─── GET ───────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    // Single tournament with teams + matches
    if (id) {
      try {
        const tournament = await prisma.tournament.findUnique({
          where: { id },
          include: {
            teams: { orderBy: [{ division: "asc" }, { seed: "asc" }] },
            matches: {
              include: { team1: true, team2: true, winner: true },
              orderBy: [{ round: "asc" }, { division: "asc" }, { matchNumber: "asc" }],
            },
          },
        });

        if (tournament) {
          return NextResponse.json({ tournament });
        }

        // Fall through to demo
        const demo = getDemoData().find((t) => t.id === id);
        if (demo) {
          return NextResponse.json({ tournament: demo, demo: true });
        }
        return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
      } catch {
        const demo = getDemoData().find((t) => t.id === id);
        if (demo) {
          return NextResponse.json({ tournament: demo, demo: true });
        }
        return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
      }
    }

    // List all tournaments
    try {
      const tournaments = await prisma.tournament.findMany({
        include: {
          _count: { select: { teams: true, matches: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      if (tournaments.length > 0) {
        return NextResponse.json({ tournaments });
      }

      // Fall back to demo
      const demos = getDemoData().map((t) => ({
        ...t,
        _count: { teams: t.teams.length, matches: t.matches.length },
      }));
      return NextResponse.json({ tournaments: demos, demo: true });
    } catch {
      const demos = getDemoData().map((t) => ({
        ...t,
        _count: { teams: t.teams.length, matches: t.matches.length },
      }));
      return NextResponse.json({ tournaments: demos, demo: true });
    }
  } catch {
    return NextResponse.json({ tournaments: [] }, { status: 500 });
  }
}

// ─── POST ──────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, teams } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Tournament name is required" }, { status: 400 });
    }

    try {
      const tournament = await prisma.tournament.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          teams: teams?.length
            ? {
                create: teams.map(
                  (
                    t: { player1Name: string; player2Name: string; division: string; seed?: number },
                    i: number
                  ) => ({
                    player1Name: t.player1Name.trim(),
                    player2Name: t.player2Name.trim(),
                    division: t.division,
                    seed: t.seed ?? i + 1,
                  })
                ),
              }
            : undefined,
        },
        include: { teams: true, matches: true },
      });
      return NextResponse.json({ tournament }, { status: 201 });
    } catch {
      // Demo fallback
      demoIdCounter++;
      const newTournament: DemoTournament = {
        id: `demo-tournament-${demoIdCounter}`,
        name: name.trim(),
        description: description?.trim() || null,
        status: "SETUP",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        teams: (teams || []).map(
          (
            t: { player1Name: string; player2Name: string; division: string; seed?: number },
            i: number
          ) => {
            demoIdCounter++;
            return {
              id: `demo-team-${demoIdCounter}`,
              tournamentId: `demo-tournament-${demoIdCounter - 1}`,
              player1Name: t.player1Name.trim(),
              player2Name: t.player2Name.trim(),
              seed: t.seed ?? i + 1,
              division: t.division,
              createdAt: new Date().toISOString(),
            };
          }
        ),
        matches: [],
      };
      getDemoData().unshift(newTournament);
      return NextResponse.json({ tournament: newTournament }, { status: 201 });
    }
  } catch {
    return NextResponse.json({ error: "Failed to create tournament" }, { status: 500 });
  }
}

// ─── PATCH ─────────────────────────────────────────────────

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { id, action, matchId, winnerId, team1Score, team2Score, name, description, status } = body;

    if (!id) {
      return NextResponse.json({ error: "Tournament ID is required" }, { status: 400 });
    }

    // Update match result
    if (action === "updateMatch" && matchId) {
      try {
        const match = await prisma.tournamentMatch.update({
          where: { id: matchId },
          data: {
            winnerId: winnerId || undefined,
            team1Score: team1Score !== undefined ? team1Score : undefined,
            team2Score: team2Score !== undefined ? team2Score : undefined,
            status: winnerId ? "COMPLETED" : "IN_PROGRESS",
          },
          include: { team1: true, team2: true, winner: true },
        });
        return NextResponse.json({ match });
      } catch {
        // Demo fallback
        const tournament = getDemoData().find((t) => t.id === id);
        if (!tournament) {
          return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }
        const match = tournament.matches.find((m) => m.id === matchId);
        if (!match) {
          return NextResponse.json({ error: "Match not found" }, { status: 404 });
        }

        if (winnerId) {
          match.winnerId = winnerId;
          match.winner = tournament.teams.find((t) => t.id === winnerId) || null;
          match.status = "COMPLETED";
        }
        if (team1Score !== undefined) match.team1Score = team1Score;
        if (team2Score !== undefined) match.team2Score = team2Score;
        match.updatedAt = new Date().toISOString();

        return NextResponse.json({ match });
      }
    }

    // Update tournament metadata
    try {
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name.trim();
      if (description !== undefined) data.description = description?.trim() || null;
      if (status !== undefined) data.status = status;

      const tournament = await prisma.tournament.update({
        where: { id },
        data,
        include: {
          teams: { orderBy: [{ division: "asc" }, { seed: "asc" }] },
          matches: {
            include: { team1: true, team2: true, winner: true },
            orderBy: [{ round: "asc" }, { division: "asc" }, { matchNumber: "asc" }],
          },
        },
      });
      return NextResponse.json({ tournament });
    } catch {
      const tournament = getDemoData().find((t) => t.id === id);
      if (!tournament) {
        return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
      }
      if (name !== undefined) tournament.name = name.trim();
      if (description !== undefined) tournament.description = description?.trim() || null;
      if (status !== undefined) tournament.status = status;
      tournament.updatedAt = new Date().toISOString();

      return NextResponse.json({ tournament });
    }
  } catch {
    return NextResponse.json({ error: "Failed to update tournament" }, { status: 500 });
  }
}

// ─── DELETE ────────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    try {
      await prisma.tournament.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch {
      const demos = getDemoData();
      const index = demos.findIndex((t) => t.id === id);
      if (index === -1) {
        return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
      }
      demos.splice(index, 1);
      return NextResponse.json({ success: true });
    }
  } catch {
    return NextResponse.json({ error: "Failed to delete tournament" }, { status: 500 });
  }
}
