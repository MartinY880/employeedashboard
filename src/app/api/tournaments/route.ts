// ProConnect — Tournaments API Route
// GET: Fetch tournaments | POST: Create tournament
// PATCH: Update tournament | DELETE: Remove tournament

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

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

type SeedTeam = {
  id: string;
  tournamentId: string;
  division: string;
  seed: number;
};

type SeedMatch = {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  division: string;
  team1Id: string | null;
  team2Id: string | null;
  winnerId: string | null;
  team1Score: number | null;
  team2Score: number | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  nextMatchId: string | null;
};

const BRACKET_DIVISIONS = ["Region 1", "Region 2", "Region 3", "Region 4"] as const;

function assignWinnerToNext(
  allMatches: SeedMatch[],
  currentMatch: SeedMatch,
  winnerTeamId: string | null
) {
  if (!currentMatch.nextMatchId || !winnerTeamId) return;
  const nextMatch = allMatches.find((m) => m.id === currentMatch.nextMatchId);
  if (!nextMatch) return;

  const siblings = allMatches
    .filter(
      (m) =>
        m.tournamentId === currentMatch.tournamentId &&
        m.round === currentMatch.round &&
        m.division === currentMatch.division &&
        m.nextMatchId === currentMatch.nextMatchId
    )
    .sort((a, b) => a.matchNumber - b.matchNumber);

  const slotIndex = siblings.findIndex((m) => m.id === currentMatch.id);
  const useTeam1 = slotIndex <= 0;

  if (useTeam1) nextMatch.team1Id = winnerTeamId;
  else nextMatch.team2Id = winnerTeamId;

  if (nextMatch.status === "PENDING") {
    nextMatch.status = "IN_PROGRESS";
  }
}

function buildBracketMatches(
  teams: SeedTeam[],
  tournamentId: string,
  getMatchId: () => string
): SeedMatch[] {
  const allMatches: SeedMatch[] = [];
  const divisionFinalByName: Partial<Record<(typeof BRACKET_DIVISIONS)[number], SeedMatch>> = {};
  let maxDivisionRound = 1;

  for (const division of BRACKET_DIVISIONS) {
    const divisionTeams = teams
      .filter((team) => team.division === division)
      .sort((a, b) => a.seed - b.seed);

    if (divisionTeams.length < 2) continue;

    const rounds: SeedMatch[][] = [];
    const roundOneEntries: Array<[SeedTeam, SeedTeam | null]> = [];

    if (divisionTeams.length % 2 === 1) {
      roundOneEntries.push([divisionTeams[0], null]);
      for (let i = 1; i < divisionTeams.length; i += 2) {
        roundOneEntries.push([divisionTeams[i], divisionTeams[i + 1] || null]);
      }
    } else {
      for (let i = 0; i < divisionTeams.length; i += 2) {
        roundOneEntries.push([divisionTeams[i], divisionTeams[i + 1] || null]);
      }
    }

    const roundOneMatches: SeedMatch[] = roundOneEntries.map(([team1, team2], index) => ({
      id: getMatchId(),
      tournamentId,
      round: 1,
      matchNumber: index + 1,
      division,
      team1Id: team1.id,
      team2Id: team2?.id || null,
      winnerId: team2 ? null : team1.id,
      team1Score: null,
      team2Score: null,
      status: team2 ? "PENDING" : "COMPLETED",
      nextMatchId: null,
    }));

    rounds.push(roundOneMatches);

    let currentRoundNumber = 2;
    while (rounds[currentRoundNumber - 2].length > 1) {
      const previousRound = rounds[currentRoundNumber - 2];
      const nextRoundSize = Math.ceil(previousRound.length / 2);
      const nextRoundMatches: SeedMatch[] = Array.from({ length: nextRoundSize }).map((_, index) => ({
        id: getMatchId(),
        tournamentId,
        round: currentRoundNumber,
        matchNumber: index + 1,
        division,
        team1Id: null,
        team2Id: null,
        winnerId: null,
        team1Score: null,
        team2Score: null,
        status: "PENDING",
        nextMatchId: null,
      }));

      previousRound.forEach((match, index) => {
        const target = nextRoundMatches[Math.floor(index / 2)];
        match.nextMatchId = target.id;
      });

      rounds.push(nextRoundMatches);
      currentRoundNumber++;
    }

    const flatDivision = rounds.flat();
    allMatches.push(...flatDivision);

    flatDivision.forEach((match) => {
      if (match.winnerId) assignWinnerToNext(allMatches, match, match.winnerId);
    });

    maxDivisionRound = Math.max(maxDivisionRound, rounds.length);
    divisionFinalByName[division] = rounds[rounds.length - 1][0];
  }

  const semifinalRound = maxDivisionRound + 1;
  const finalRound = maxDivisionRound + 2;

  const semifinalOne: SeedMatch = {
    id: getMatchId(),
    tournamentId,
    round: semifinalRound,
    matchNumber: 1,
    division: "Final 4",
    team1Id: null,
    team2Id: null,
    winnerId: null,
    team1Score: null,
    team2Score: null,
    status: "PENDING",
    nextMatchId: null,
  };

  const semifinalTwo: SeedMatch = {
    id: getMatchId(),
    tournamentId,
    round: semifinalRound,
    matchNumber: 2,
    division: "Final 4",
    team1Id: null,
    team2Id: null,
    winnerId: null,
    team1Score: null,
    team2Score: null,
    status: "PENDING",
    nextMatchId: null,
  };

  const championship: SeedMatch = {
    id: getMatchId(),
    tournamentId,
    round: finalRound,
    matchNumber: 1,
    division: "Championship",
    team1Id: null,
    team2Id: null,
    winnerId: null,
    team1Score: null,
    team2Score: null,
    status: "PENDING",
    nextMatchId: null,
  };

  semifinalOne.nextMatchId = championship.id;
  semifinalTwo.nextMatchId = championship.id;

  const region1Final = divisionFinalByName["Region 1"];
  const region2Final = divisionFinalByName["Region 2"];
  const region3Final = divisionFinalByName["Region 3"];
  const region4Final = divisionFinalByName["Region 4"];

  if (region1Final) region1Final.nextMatchId = semifinalOne.id;
  if (region2Final) region2Final.nextMatchId = semifinalOne.id;
  if (region3Final) region3Final.nextMatchId = semifinalTwo.id;
  if (region4Final) region4Final.nextMatchId = semifinalTwo.id;

  allMatches.push(semifinalOne, semifinalTwo, championship);

  if (region1Final?.winnerId) assignWinnerToNext(allMatches, region1Final, region1Final.winnerId);
  if (region2Final?.winnerId) assignWinnerToNext(allMatches, region2Final, region2Final.winnerId);
  if (region3Final?.winnerId) assignWinnerToNext(allMatches, region3Final, region3Final.winnerId);
  if (region4Final?.winnerId) assignWinnerToNext(allMatches, region4Final, region4Final.winnerId);

  return allMatches;
}

function needsBracketBackfill(
  matches: Array<{ round: number; nextMatchId: string | null }>
): boolean {
  if (matches.length === 0) return true;
  const hasLaterRounds = matches.some((match) => match.round >= 2);
  const hasLinks = matches.some((match) => !!match.nextMatchId);
  return !hasLaterRounds || !hasLinks;
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

  }

  const teamsById = new Map(allTeams.map((team) => [team.id, team]));
  const seededMatches = buildBracketMatches(
    allTeams.map((team) => ({
      id: team.id,
      tournamentId: team.tournamentId,
      division: team.division,
      seed: team.seed,
    })),
    tournamentId,
    () => {
      matchCounter++;
      return `demo-match-${matchCounter}`;
    }
  );

  allMatches.push(
    ...seededMatches.map((match) => ({
      id: match.id,
      tournamentId: match.tournamentId,
      round: match.round,
      matchNumber: match.matchNumber,
      division: match.division,
      team1Id: match.team1Id,
      team2Id: match.team2Id,
      team1: match.team1Id ? teamsById.get(match.team1Id) || null : null,
      team2: match.team2Id ? teamsById.get(match.team2Id) || null : null,
      winnerId: match.winnerId,
      winner: match.winnerId ? teamsById.get(match.winnerId) || null : null,
      team1Score: match.team1Score,
      team2Score: match.team2Score,
      status: match.status,
      nextMatchId: match.nextMatchId,
      createdAt: now,
      updatedAt: now,
    }))
  );

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
          if (tournament.teams.length > 1 && needsBracketBackfill(tournament.matches)) {
            const existingByKey = new Map(
              tournament.matches.map((match) => [
                `${match.division}|${match.round}|${match.matchNumber}`,
                match,
              ])
            );

            const rebuilt = buildBracketMatches(
              tournament.teams.map((team) => ({
                id: team.id,
                tournamentId: tournament.id,
                division: team.division,
                seed: team.seed,
              })),
              tournament.id,
              () => `match-${crypto.randomUUID()}`
            );

            const merged = rebuilt.map((match) => {
              const old = existingByKey.get(`${match.division}|${match.round}|${match.matchNumber}`);
              if (!old) return match;

              const winnerStillValid =
                !!old.winnerId && (old.winnerId === match.team1Id || old.winnerId === match.team2Id);

              return {
                ...match,
                winnerId: winnerStillValid ? old.winnerId : match.winnerId,
                team1Score: old.team1Score ?? match.team1Score,
                team2Score: old.team2Score ?? match.team2Score,
                status: winnerStillValid
                  ? "COMPLETED"
                  : old.status === "IN_PROGRESS"
                  ? "IN_PROGRESS"
                  : match.status,
              };
            });

            merged.forEach((match) => {
              if (match.winnerId) assignWinnerToNext(merged, match, match.winnerId);
            });

            await prisma.tournamentMatch.deleteMany({ where: { tournamentId: tournament.id } });
            await prisma.tournamentMatch.createMany({
              data: merged.map((match) => ({
                id: match.id,
                tournamentId: match.tournamentId,
                round: match.round,
                matchNumber: match.matchNumber,
                division: match.division,
                team1Id: match.team1Id,
                team2Id: match.team2Id,
                winnerId: match.winnerId,
                team1Score: match.team1Score,
                team2Score: match.team2Score,
                status: match.status,
                nextMatchId: match.nextMatchId,
              })),
            });

            const refreshed = await prisma.tournament.findUnique({
              where: { id },
              include: {
                teams: { orderBy: [{ division: "asc" }, { seed: "asc" }] },
                matches: {
                  include: { team1: true, team2: true, winner: true },
                  orderBy: [{ round: "asc" }, { division: "asc" }, { matchNumber: "asc" }],
                },
              },
            });

            return NextResponse.json({ tournament: refreshed });
          }

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
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_TOURNAMENT)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, teams } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Tournament name is required" }, { status: 400 });
    }

    try {
      const created = await prisma.tournament.create({
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
        include: { teams: true },
      });

      if (created.teams.length > 1) {
        const seededMatches = buildBracketMatches(
          created.teams.map((team) => ({
            id: team.id,
            tournamentId: created.id,
            division: team.division,
            seed: team.seed,
          })),
          created.id,
          () => `match-${crypto.randomUUID()}`
        );

        await prisma.tournamentMatch.createMany({
          data: seededMatches.map((match) => ({
            id: match.id,
            tournamentId: match.tournamentId,
            round: match.round,
            matchNumber: match.matchNumber,
            division: match.division,
            team1Id: match.team1Id,
            team2Id: match.team2Id,
            winnerId: match.winnerId,
            team1Score: match.team1Score,
            team2Score: match.team2Score,
            status: match.status,
            nextMatchId: match.nextMatchId,
          })),
        });
      }

      const tournament = await prisma.tournament.findUnique({
        where: { id: created.id },
        include: {
          teams: { orderBy: [{ division: "asc" }, { seed: "asc" }] },
          matches: {
            include: { team1: true, team2: true, winner: true },
            orderBy: [{ round: "asc" }, { division: "asc" }, { matchNumber: "asc" }],
          },
        },
      });

      return NextResponse.json({ tournament }, { status: 201 });
    } catch {
      // Demo fallback
      demoIdCounter++;
      const tournamentId = `demo-tournament-${demoIdCounter}`;
      const newTournament: DemoTournament = {
        id: tournamentId,
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
            const team = {
              id: `demo-team-${demoIdCounter}`,
              tournamentId,
              player1Name: t.player1Name.trim(),
              player2Name: t.player2Name.trim(),
              seed: t.seed ?? i + 1,
              division: t.division,
              createdAt: new Date().toISOString(),
            };
            return team;
          }
        ),
        matches: [],
      };

      const teamsById = new Map(newTournament.teams.map((team) => [team.id, team]));
      const seededMatches = buildBracketMatches(
        newTournament.teams.map((team) => ({
          id: team.id,
          tournamentId: newTournament.id,
          division: team.division,
          seed: team.seed,
        })),
        newTournament.id,
        () => {
          demoIdCounter++;
          return `demo-match-${demoIdCounter}`;
        }
      );

      newTournament.matches = seededMatches.map((match) => ({
        id: match.id,
        tournamentId: match.tournamentId,
        round: match.round,
        matchNumber: match.matchNumber,
        division: match.division,
        team1Id: match.team1Id,
        team2Id: match.team2Id,
        team1: match.team1Id ? teamsById.get(match.team1Id) || null : null,
        team2: match.team2Id ? teamsById.get(match.team2Id) || null : null,
        winnerId: match.winnerId,
        winner: match.winnerId ? teamsById.get(match.winnerId) || null : null,
        team1Score: match.team1Score,
        team2Score: match.team2Score,
        status: match.status,
        nextMatchId: match.nextMatchId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

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
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_TOURNAMENT)) {
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
        const match = await prisma.$transaction(async (tx) => {
          const normalizeAndCascade = async (targetMatchId: string): Promise<void> => {
            const target = await tx.tournamentMatch.findUnique({
              where: { id: targetMatchId },
              select: {
                id: true,
                tournamentId: true,
                round: true,
                division: true,
                matchNumber: true,
                team1Id: true,
                team2Id: true,
                winnerId: true,
                status: true,
                nextMatchId: true,
              },
            });

            if (!target) return;

            const hasBothTeams = !!target.team1Id && !!target.team2Id;
            const winnerStillValid =
              !!target.winnerId &&
              (target.winnerId === target.team1Id || target.winnerId === target.team2Id);

            const desiredStatus = winnerStillValid
              ? "COMPLETED"
              : hasBothTeams
              ? "IN_PROGRESS"
              : "PENDING";

            if (!winnerStillValid && target.winnerId) {
              const clearedWinnerId = target.winnerId;

              await tx.tournamentMatch.update({
                where: { id: target.id },
                data: {
                  winnerId: null,
                  team1Score: null,
                  team2Score: null,
                  status: desiredStatus,
                },
              });

              if (target.nextMatchId) {
                const siblings = await tx.tournamentMatch.findMany({
                  where: {
                    tournamentId: target.tournamentId,
                    round: target.round,
                    division: target.division,
                    nextMatchId: target.nextMatchId,
                  },
                  orderBy: { matchNumber: "asc" },
                });

                const slotIndex = siblings.findIndex((m) => m.id === target.id);
                const useTeam1 = slotIndex <= 0;

                const nextCurrent = await tx.tournamentMatch.findUnique({
                  where: { id: target.nextMatchId },
                  select: { team1Id: true, team2Id: true },
                });

                if (nextCurrent) {
                  const clearData = useTeam1
                    ? { team1Id: nextCurrent.team1Id === clearedWinnerId ? null : nextCurrent.team1Id }
                    : { team2Id: nextCurrent.team2Id === clearedWinnerId ? null : nextCurrent.team2Id };

                  await tx.tournamentMatch.update({
                    where: { id: target.nextMatchId },
                    data: clearData,
                  });
                }

                await normalizeAndCascade(target.nextMatchId);
              }

              return;
            }

            if (target.status !== desiredStatus) {
              await tx.tournamentMatch.update({
                where: { id: target.id },
                data: { status: desiredStatus },
              });
            }
          };

          const current = await tx.tournamentMatch.findUnique({
            where: { id: matchId },
            select: {
              id: true,
              tournamentId: true,
              round: true,
              division: true,
              matchNumber: true,
              team1Id: true,
              team2Id: true,
              nextMatchId: true,
            },
          });

          if (!current) {
            throw new Error("Match not found");
          }

          const normalizedWinnerId = typeof winnerId === "string" && winnerId.trim() ? winnerId : null;
          const hasBothTeams = !!current.team1Id && !!current.team2Id;

          const updated = await tx.tournamentMatch.update({
            where: { id: matchId },
            data: {
              winnerId: normalizedWinnerId,
              team1Score: team1Score !== undefined ? team1Score : undefined,
              team2Score: team2Score !== undefined ? team2Score : undefined,
              status: normalizedWinnerId ? "COMPLETED" : hasBothTeams ? "IN_PROGRESS" : "PENDING",
            },
            include: { team1: true, team2: true, winner: true },
          });

          if (updated.nextMatchId) {
            const siblings = await tx.tournamentMatch.findMany({
              where: {
                tournamentId: id,
                round: updated.round,
                division: updated.division,
                nextMatchId: updated.nextMatchId,
              },
              orderBy: { matchNumber: "asc" },
            });

            const slotIndex = siblings.findIndex((m) => m.id === updated.id);
            const useTeam1 = slotIndex <= 0;

            const nextCurrent = await tx.tournamentMatch.findUnique({
              where: { id: updated.nextMatchId },
              select: { team1Id: true, team2Id: true },
            });

            const nextData = useTeam1
              ? { team1Id: normalizedWinnerId }
              : { team2Id: normalizedWinnerId };

            await tx.tournamentMatch.update({
              where: { id: updated.nextMatchId },
              data: {
                ...nextData,
                status:
                  normalizedWinnerId ||
                  !!(useTeam1 ? normalizedWinnerId : nextCurrent?.team1Id) &&
                    !!(useTeam1 ? nextCurrent?.team2Id : normalizedWinnerId)
                    ? "IN_PROGRESS"
                    : "PENDING",
              },
            });

            await normalizeAndCascade(updated.nextMatchId);
          }

          const refreshed = await tx.tournamentMatch.findUnique({
            where: { id: matchId },
            include: { team1: true, team2: true, winner: true },
          });

          return refreshed;
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

          if (match.nextMatchId) {
            const next = tournament.matches.find((m) => m.id === match.nextMatchId);
            if (next) {
              const siblings = tournament.matches
                .filter(
                  (m) =>
                    m.tournamentId === tournament.id &&
                    m.round === match.round &&
                    m.division === match.division &&
                    m.nextMatchId === match.nextMatchId
                )
                .sort((a, b) => a.matchNumber - b.matchNumber);

              const slotIndex = siblings.findIndex((m) => m.id === match.id);
              const useTeam1 = slotIndex <= 0;

              if (useTeam1) {
                next.team1Id = winnerId;
                next.team1 = tournament.teams.find((t) => t.id === winnerId) || null;
              } else {
                next.team2Id = winnerId;
                next.team2 = tournament.teams.find((t) => t.id === winnerId) || null;
              }

              if (next.status === "PENDING") next.status = "IN_PROGRESS";
              next.updatedAt = new Date().toISOString();
            }
          }
        } else {
          match.winnerId = null;
          match.winner = null;
          match.status = match.team1Id && match.team2Id ? "IN_PROGRESS" : "PENDING";

          if (match.nextMatchId) {
            const next = tournament.matches.find((m) => m.id === match.nextMatchId);
            if (next) {
              const siblings = tournament.matches
                .filter(
                  (m) =>
                    m.tournamentId === tournament.id &&
                    m.round === match.round &&
                    m.division === match.division &&
                    m.nextMatchId === match.nextMatchId
                )
                .sort((a, b) => a.matchNumber - b.matchNumber);

              const slotIndex = siblings.findIndex((m) => m.id === match.id);
              const useTeam1 = slotIndex <= 0;

              if (useTeam1) {
                next.team1Id = null;
                next.team1 = null;
              } else {
                next.team2Id = null;
                next.team2 = null;
              }

              const normalizeDemo = (target: DemoMatch) => {
                const winnerValid =
                  !!target.winnerId &&
                  (target.winnerId === target.team1Id || target.winnerId === target.team2Id);

                if (!winnerValid && target.winnerId) {
                  const removedWinnerId = target.winnerId;
                  target.winnerId = null;
                  target.winner = null;
                  target.team1Score = null;
                  target.team2Score = null;

                  if (target.nextMatchId) {
                    const child = tournament.matches.find((m) => m.id === target.nextMatchId);
                    if (child) {
                      const childSiblings = tournament.matches
                        .filter(
                          (m) =>
                            m.tournamentId === tournament.id &&
                            m.round === target.round &&
                            m.division === target.division &&
                            m.nextMatchId === target.nextMatchId
                        )
                        .sort((a, b) => a.matchNumber - b.matchNumber);

                      const childSlot = childSiblings.findIndex((m) => m.id === target.id);
                      const childUseTeam1 = childSlot <= 0;

                      if (childUseTeam1 && child.team1Id === removedWinnerId) {
                        child.team1Id = null;
                        child.team1 = null;
                      }
                      if (!childUseTeam1 && child.team2Id === removedWinnerId) {
                        child.team2Id = null;
                        child.team2 = null;
                      }

                      normalizeDemo(child);
                    }
                  }
                }

                target.status =
                  target.winnerId && (target.winnerId === target.team1Id || target.winnerId === target.team2Id)
                    ? "COMPLETED"
                    : target.team1Id && target.team2Id
                    ? "IN_PROGRESS"
                    : "PENDING";
                target.updatedAt = new Date().toISOString();
              };

              normalizeDemo(next);
            }
          }
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
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_TOURNAMENT)) {
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
