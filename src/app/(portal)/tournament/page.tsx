// ProConnect — Tournament Bracket Page
// True bracket-style visualization with connector lines across rounds

"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Trophy, Users, Medal, Crown, Swords } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTournament } from "@/hooks/useTournament";
import type { Tournament, TournamentMatch, TournamentTeam } from "@/types";

/* ------------------------------------------------------------------ */
/* Layout constants                                                    */
/* ------------------------------------------------------------------ */

const CARD_W = 210;
const CARD_H = 52;
const R1_GAP = 10;
const ROUND_GAP = 48;
const ROUND_STEP = CARD_W + ROUND_GAP;

const DIVISIONS = ["Region 1", "Region 2", "Region 3", "Region 4"] as const;

const DIVISION_THEMES: Record<
  string,
  { accent: string; bg: string; text: string; line: string; lineDim: string }
> = {
  "Region 1": {
    accent: "bg-blue-500",
    bg: "bg-blue-50",
    text: "text-blue-700",
    line: "#3b82f6",
    lineDim: "#93c5fd",
  },
  "Region 2": {
    accent: "bg-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    line: "#10b981",
    lineDim: "#6ee7b7",
  },
  "Region 3": {
    accent: "bg-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
    line: "#f59e0b",
    lineDim: "#fcd34d",
  },
  "Region 4": {
    accent: "bg-purple-500",
    bg: "bg-purple-50",
    text: "text-purple-700",
    line: "#8b5cf6",
    lineDim: "#c4b5fd",
  },
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  SETUP: { label: "Setup", className: "bg-gray-100 text-gray-600" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-700" },
};

/* ------------------------------------------------------------------ */
/* Bracket position helpers                                            */
/* ------------------------------------------------------------------ */

interface BracketSlot {
  round: number;
  index: number;
  x: number;
  y: number;
  centerY: number;
  match: TournamentMatch | null;
}

interface ConnectorLine {
  topY: number;
  bottomY: number;
  nextY: number;
  midX: number;
  fromX: number;
  toX: number;
}

function buildBracketLayout(matches: TournamentMatch[]) {
  const byRound: Record<number, TournamentMatch[]> = {};
  for (const m of matches) {
    if (!byRound[m.round]) byRound[m.round] = [];
    byRound[m.round].push(m);
  }
  for (const r in byRound) {
    byRound[r].sort((a, b) => a.matchNumber - b.matchNumber);
  }

  const r1Count = byRound[1]?.length || 8;
  const numRounds = Math.max(1, Math.ceil(Math.log2(r1Count * 2)));

  const roundSlots: BracketSlot[][] = [];
  const allConnectors: ConnectorLine[] = [];

  // Round 1 positions
  const r1Slots: BracketSlot[] = [];
  for (let i = 0; i < r1Count; i++) {
    const y = i * (CARD_H + R1_GAP);
    r1Slots.push({
      round: 1,
      index: i,
      x: 0,
      y,
      centerY: y + CARD_H / 2,
      match: byRound[1]?.[i] || null,
    });
  }
  roundSlots.push(r1Slots);

  // Subsequent rounds — center between parent pairs
  let prevSlots = r1Slots;
  for (let r = 2; r <= numRounds; r++) {
    const curSlots: BracketSlot[] = [];
    const x = (r - 1) * ROUND_STEP;
    const curMatchCount = Math.floor(prevSlots.length / 2);

    for (let j = 0; j < curMatchCount; j++) {
      const top = prevSlots[j * 2];
      const bottom = prevSlots[j * 2 + 1];
      const centerY = (top.centerY + bottom.centerY) / 2;
      const y = centerY - CARD_H / 2;

      curSlots.push({
        round: r,
        index: j,
        x,
        y,
        centerY,
        match: byRound[r]?.[j] || null,
      });

      const midX = top.x + CARD_W + ROUND_GAP / 2;
      allConnectors.push({
        topY: top.centerY,
        bottomY: bottom.centerY,
        nextY: centerY,
        midX,
        fromX: top.x + CARD_W,
        toX: x,
      });
    }

    roundSlots.push(curSlots);
    prevSlots = curSlots;
  }

  const totalH = r1Count * CARD_H + (r1Count - 1) * R1_GAP;
  const totalW = numRounds * CARD_W + (numRounds - 1) * ROUND_GAP;

  return { roundSlots, allConnectors, totalH, totalW, numRounds };
}

function getRoundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Division Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  if (round === 1) return "Round 1";
  return `Round ${round}`;
}

/* ------------------------------------------------------------------ */
/* Bracket Match Card                                                  */
/* ------------------------------------------------------------------ */

function BracketCard({ slot, lineColor }: { slot: BracketSlot; lineColor: string }) {
  const m = slot.match;
  const isBye = m && !m.team2Id && m.winnerId === m.team1Id;
  const isComplete = m?.status === "COMPLETED";

  const team1Name = m?.team1
    ? `${m.team1.player1Name} / ${m.team1.player2Name}`
    : "TBD";
  const team2Name = m?.team2
    ? `${m.team2.player1Name} / ${m.team2.player2Name}`
    : isBye
    ? "BYE"
    : "TBD";

  const t1Winner = m?.winnerId === m?.team1Id && isComplete;
  const t2Winner = m?.winnerId === m?.team2Id && isComplete;

  return (
    <div
      className="absolute rounded-md border bg-white shadow-sm overflow-hidden select-none"
      style={{
        left: slot.x,
        top: slot.y,
        width: CARD_W,
        height: CARD_H,
        borderColor: isComplete ? lineColor : "#e5e7eb",
      }}
    >
      {/* Team 1 */}
      <div
        className={`flex items-center justify-between px-2 h-1/2 border-b transition-colors ${
          t1Winner ? "bg-emerald-50" : "bg-white"
        }`}
        style={{ borderColor: "#f3f4f6" }}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
          {t1Winner && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
          <span
            className={`text-[11px] leading-tight truncate ${
              t1Winner
                ? "font-bold text-gray-900"
                : m?.team1
                ? "text-gray-700"
                : "text-gray-400 italic"
            }`}
          >
            {team1Name}
          </span>
        </div>
        {m?.team1Score !== null && m?.team1Score !== undefined && (
          <span
            className={`text-[11px] font-bold tabular-nums ml-1 shrink-0 ${
              t1Winner ? "text-emerald-600" : "text-gray-400"
            }`}
          >
            {m.team1Score}
          </span>
        )}
      </div>
      {/* Team 2 */}
      <div
        className={`flex items-center justify-between px-2 h-1/2 transition-colors ${
          t2Winner ? "bg-emerald-50" : "bg-white"
        }`}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
          {t2Winner && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
          <span
            className={`text-[11px] leading-tight truncate ${
              isBye
                ? "text-gray-400 italic"
                : t2Winner
                ? "font-bold text-gray-900"
                : m?.team2
                ? "text-gray-700"
                : "text-gray-400 italic"
            }`}
          >
            {team2Name}
          </span>
        </div>
        {m?.team2Score !== null && m?.team2Score !== undefined && (
          <span
            className={`text-[11px] font-bold tabular-nums ml-1 shrink-0 ${
              t2Winner ? "text-emerald-600" : "text-gray-400"
            }`}
          >
            {m.team2Score}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SVG Connector Lines                                                 */
/* ------------------------------------------------------------------ */

function BracketConnectors({
  connectors,
  lineColor,
  lineDim,
}: {
  connectors: ConnectorLine[];
  lineColor: string;
  lineDim: string;
}) {
  return (
    <>
      {connectors.map((c, i) => (
        <g key={i}>
          {/* Horizontal from top match → mid */}
          <line x1={c.fromX} y1={c.topY} x2={c.midX} y2={c.topY} stroke={lineDim} strokeWidth={2} />
          {/* Horizontal from bottom match → mid */}
          <line x1={c.fromX} y1={c.bottomY} x2={c.midX} y2={c.bottomY} stroke={lineDim} strokeWidth={2} />
          {/* Vertical bar connecting top-bottom */}
          <line x1={c.midX} y1={c.topY} x2={c.midX} y2={c.bottomY} stroke={lineDim} strokeWidth={2} />
          {/* Horizontal from midpoint → next match */}
          <line x1={c.midX} y1={c.nextY} x2={c.toX} y2={c.nextY} stroke={lineColor} strokeWidth={2} />
        </g>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Unified Four-Region Bracket                                         */
/* ------------------------------------------------------------------ */

function buildRegionLayout(matches: TournamentMatch[], reverse = false) {
  const layout = buildBracketLayout(matches);
  if (!reverse) return layout;

  const mirroredSlots = layout.roundSlots.map((round) =>
    round.map((slot) => ({
      ...slot,
      x: layout.totalW - CARD_W - slot.x,
    }))
  );

  const mirroredConnectors = layout.allConnectors.map((connector) => ({
    ...connector,
    fromX: layout.totalW - connector.fromX,
    toX: layout.totalW - connector.toX,
    midX: layout.totalW - connector.midX,
  }));

  return {
    ...layout,
    roundSlots: mirroredSlots,
    allConnectors: mirroredConnectors,
  };
}

function getRegionFinalSlot(roundSlots: BracketSlot[][]): BracketSlot | null {
  if (!roundSlots.length) return null;
  const finalRound = roundSlots[roundSlots.length - 1];
  return finalRound?.[0] || null;
}

function UnifiedTournamentBracket({
  matchesByDivision,
  teamsByDivision,
  allMatches,
}: {
  matchesByDivision: Record<string, TournamentMatch[]>;
  teamsByDivision: Record<string, TournamentTeam[]>;
  allMatches: TournamentMatch[];
}) {
  const regionOrderLeft = ["Region 1", "Region 2"];
  const regionOrderRight = ["Region 3", "Region 4"];

  const regionLayouts = useMemo(() => {
    const out: Record<string, ReturnType<typeof buildRegionLayout>> = {};
    for (const region of DIVISIONS) {
      const reverse = regionOrderRight.includes(region);
      out[region] = buildRegionLayout(matchesByDivision[region] || [], reverse);
    }
    return out;
  }, [matchesByDivision]);

  const sideW = Math.max(...DIVISIONS.map((d) => regionLayouts[d].totalW), CARD_W);
  const regionGapY = 56;
  const topH = Math.max(regionLayouts["Region 1"].totalH, regionLayouts["Region 3"].totalH, CARD_H);
  const bottomH = Math.max(regionLayouts["Region 2"].totalH, regionLayouts["Region 4"].totalH, CARD_H);
  const sideH = topH + regionGapY + bottomH;

  const centerGap = CARD_W * 2 + 120;
  const totalW = sideW * 2 + centerGap;
  const totalH = sideH;

  const leftBaseX = 0;
  const rightBaseX = totalW - sideW;
  const topBaseY = 0;
  const bottomBaseY = topH + regionGapY;

  const maxDivisionRound = Math.max(
    1,
    ...allMatches.filter((m) => DIVISIONS.includes(m.division as (typeof DIVISIONS)[number])).map((m) => m.round)
  );
  const semifinalRound = maxDivisionRound + 1;
  const finalRound = maxDivisionRound + 2;

  const semifinals = allMatches
    .filter((m) => m.round === semifinalRound)
    .sort((a, b) => a.matchNumber - b.matchNumber);
  const championship = allMatches.find((m) => m.round === finalRound) || null;

  const region1Final = getRegionFinalSlot(regionLayouts["Region 1"].roundSlots);
  const region2Final = getRegionFinalSlot(regionLayouts["Region 2"].roundSlots);
  const region3Final = getRegionFinalSlot(regionLayouts["Region 3"].roundSlots);
  const region4Final = getRegionFinalSlot(regionLayouts["Region 4"].roundSlots);

  const leftSemiCenterY = (() => {
    const top = (region1Final?.centerY || CARD_H / 2) + topBaseY;
    const bottom = (region2Final?.centerY || CARD_H / 2) + bottomBaseY;
    return (top + bottom) / 2;
  })();
  const rightSemiCenterY = (() => {
    const top = (region3Final?.centerY || CARD_H / 2) + topBaseY;
    const bottom = (region4Final?.centerY || CARD_H / 2) + bottomBaseY;
    return (top + bottom) / 2;
  })();
  const finalCenterY = (leftSemiCenterY + rightSemiCenterY) / 2;

  const leftSemiX = sideW + 24;
  const rightSemiX = totalW - sideW - CARD_W - 24;
  const finalX = Math.round((totalW - CARD_W) / 2);

  const leftRoundLabels = ["First Round", "Second Round", "Sweet 16", "Elite Eight"];
  const rightRoundLabels = ["Elite Eight", "Sweet 16", "Second Round", "First Round"];

  const leftSemiSlot: BracketSlot = {
    round: semifinalRound,
    index: 0,
    x: leftSemiX,
    y: leftSemiCenterY - CARD_H / 2,
    centerY: leftSemiCenterY,
    match: semifinals[0] || null,
  };

  const rightSemiSlot: BracketSlot = {
    round: semifinalRound,
    index: 1,
    x: rightSemiX,
    y: rightSemiCenterY - CARD_H / 2,
    centerY: rightSemiCenterY,
    match: semifinals[1] || null,
  };

  const finalSlot: BracketSlot = {
    round: finalRound,
    index: 0,
    x: finalX,
    y: finalCenterY - CARD_H / 2,
    centerY: finalCenterY,
    match: championship,
  };

  const place = (slot: BracketSlot, x: number, y: number): BracketSlot => ({
    ...slot,
    x: slot.x + x,
    y: slot.y + y,
    centerY: slot.centerY + y,
  });

  const connectors = [
    {
      topY: (region1Final?.centerY || CARD_H / 2) + topBaseY,
      bottomY: (region2Final?.centerY || CARD_H / 2) + bottomBaseY,
      nextY: leftSemiCenterY,
      midX: leftSemiX - ROUND_GAP / 2,
      fromX: leftBaseX + sideW - ROUND_STEP + CARD_W,
      toX: leftSemiX,
      line: "#3b82f6",
      dim: "#93c5fd",
    },
    {
      topY: (region3Final?.centerY || CARD_H / 2) + topBaseY,
      bottomY: (region4Final?.centerY || CARD_H / 2) + bottomBaseY,
      nextY: rightSemiCenterY,
      midX: rightSemiX + CARD_W + ROUND_GAP / 2,
      fromX: rightBaseX + ROUND_STEP - ROUND_GAP,
      toX: rightSemiX + CARD_W,
      line: "#8b5cf6",
      dim: "#c4b5fd",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <div className="p-5" style={{ minWidth: totalW + 40 }}>
        <div className="relative mb-4" style={{ width: totalW, height: 24 }}>
          {leftRoundLabels.map((label, index) => (
            <div
              key={`left-${label}`}
              className="absolute text-[10px] font-semibold uppercase tracking-wider text-slate-600"
              style={{ left: leftBaseX + index * ROUND_STEP, width: CARD_W }}
            >
              {label}
            </div>
          ))}
          {rightRoundLabels.map((label, index) => (
            <div
              key={`right-${label}`}
              className="absolute text-[10px] font-semibold uppercase tracking-wider text-slate-600 text-right"
              style={{ left: rightBaseX + index * ROUND_STEP, width: CARD_W }}
            >
              {label}
            </div>
          ))}
          <div
            className="absolute z-10 text-[10px] font-semibold uppercase tracking-wider text-slate-700 text-center bg-white/95 px-1 rounded"
            style={{ left: leftSemiSlot.x, width: CARD_W }}
          >
            Final 4
          </div>
          <div
            className="absolute z-10 text-[10px] font-semibold uppercase tracking-wider text-slate-800 text-center bg-white/95 px-1 rounded"
            style={{ left: finalSlot.x, width: CARD_W }}
          >
            Championship
          </div>
        </div>

        <div className="relative" style={{ width: totalW, height: totalH }}>
          <svg className="absolute inset-0 pointer-events-none" width={totalW} height={totalH} style={{ overflow: "visible" }}>
            <g transform={`translate(${leftBaseX},${topBaseY})`}>
              <BracketConnectors
                connectors={regionLayouts["Region 1"].allConnectors}
                lineColor={DIVISION_THEMES["Region 1"].line}
                lineDim={DIVISION_THEMES["Region 1"].lineDim}
              />
            </g>
            <g transform={`translate(${leftBaseX},${bottomBaseY})`}>
              <BracketConnectors
                connectors={regionLayouts["Region 2"].allConnectors}
                lineColor={DIVISION_THEMES["Region 2"].line}
                lineDim={DIVISION_THEMES["Region 2"].lineDim}
              />
            </g>
            <g transform={`translate(${rightBaseX},${topBaseY})`}>
              <BracketConnectors
                connectors={regionLayouts["Region 3"].allConnectors}
                lineColor={DIVISION_THEMES["Region 3"].line}
                lineDim={DIVISION_THEMES["Region 3"].lineDim}
              />
            </g>
            <g transform={`translate(${rightBaseX},${bottomBaseY})`}>
              <BracketConnectors
                connectors={regionLayouts["Region 4"].allConnectors}
                lineColor={DIVISION_THEMES["Region 4"].line}
                lineDim={DIVISION_THEMES["Region 4"].lineDim}
              />
            </g>

            {connectors.map((c, i) => (
              <g key={i}>
                <line x1={c.fromX} y1={c.topY} x2={c.midX} y2={c.topY} stroke={c.dim} strokeWidth={2} />
                <line x1={c.fromX} y1={c.bottomY} x2={c.midX} y2={c.bottomY} stroke={c.dim} strokeWidth={2} />
                <line x1={c.midX} y1={c.topY} x2={c.midX} y2={c.bottomY} stroke={c.dim} strokeWidth={2} />
                <line x1={c.midX} y1={c.nextY} x2={c.toX} y2={c.nextY} stroke={c.line} strokeWidth={2} />
              </g>
            ))}

            <line
              x1={leftSemiSlot.x + CARD_W}
              y1={leftSemiSlot.centerY}
              x2={finalSlot.x}
              y2={leftSemiSlot.centerY}
              stroke="#334155"
              strokeWidth={2}
            />
            <line
              x1={rightSemiSlot.x}
              y1={rightSemiSlot.centerY}
              x2={finalSlot.x + CARD_W}
              y2={rightSemiSlot.centerY}
              stroke="#334155"
              strokeWidth={2}
            />
          </svg>

          {regionLayouts["Region 1"].roundSlots.flat().map((slot) => (
            <BracketCard key={`r1-r${slot.round}-${slot.index}`} slot={place(slot, leftBaseX, topBaseY)} lineColor={DIVISION_THEMES["Region 1"].line} />
          ))}
          {regionLayouts["Region 2"].roundSlots.flat().map((slot) => (
            <BracketCard key={`r2-r${slot.round}-${slot.index}`} slot={place(slot, leftBaseX, bottomBaseY)} lineColor={DIVISION_THEMES["Region 2"].line} />
          ))}
          {regionLayouts["Region 3"].roundSlots.flat().map((slot) => (
            <BracketCard key={`r3-r${slot.round}-${slot.index}`} slot={place(slot, rightBaseX, topBaseY)} lineColor={DIVISION_THEMES["Region 3"].line} />
          ))}
          {regionLayouts["Region 4"].roundSlots.flat().map((slot) => (
            <BracketCard key={`r4-r${slot.round}-${slot.index}`} slot={place(slot, rightBaseX, bottomBaseY)} lineColor={DIVISION_THEMES["Region 4"].line} />
          ))}

          <BracketCard slot={leftSemiSlot} lineColor="#1e40af" />
          <BracketCard slot={rightSemiSlot} lineColor="#6d28d9" />
          <BracketCard slot={finalSlot} lineColor="#334155" />
        </div>
      </div>

      <div className="border-t bg-gray-50 px-5 py-3 text-xs text-gray-600 flex items-center justify-between">
        <span>{DIVISIONS.reduce((acc, d) => acc + (teamsByDivision[d]?.length || 0), 0)} teams across 4 regions</span>
        <span>{allMatches.filter((m) => m.status === "COMPLETED").length}/{allMatches.length} matches complete</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function TournamentPage() {
  const { tournaments, isLoading } = useTournament();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeTournament = useMemo(() => {
    if (selectedId) return tournaments.find((t) => t.id === selectedId) || null;
    return tournaments[0] || null;
  }, [tournaments, selectedId]);

  return (
    <TournamentContent
      tournament={activeTournament}
      isLoading={isLoading}
      tournaments={tournaments}
      onSelect={setSelectedId}
    />
  );
}

function TournamentContent({
  tournament: listTournament,
  isLoading: listLoading,
  tournaments,
  onSelect,
}: {
  tournament: Tournament | null;
  isLoading: boolean;
  tournaments: Tournament[];
  onSelect: (id: string) => void;
}) {
  const { tournament: fullTournament, isLoading: detailLoading } = useTournament(
    listTournament?.id
  );

  const tournament = fullTournament || listTournament;
  const isLoading = listLoading || detailLoading;

  const matchesByDivision = useMemo(() => {
    if (!tournament?.matches) return {};
    const g: Record<string, TournamentMatch[]> = {};
    for (const m of tournament.matches) {
      if (!g[m.division]) g[m.division] = [];
      g[m.division].push(m);
    }
    return g;
  }, [tournament?.matches]);

  const teamsByDivision = useMemo(() => {
    if (!tournament?.teams) return {};
    const g: Record<string, TournamentTeam[]> = {};
    for (const t of tournament.teams) {
      if (!g[t.division]) g[t.division] = [];
      g[t.division].push(t);
    }
    return g;
  }, [tournament?.teams]);

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        <Skeleton className="h-12 w-96 rounded-xl" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
            <Trophy className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Tournament Yet</h2>
          <p className="text-brand-grey text-sm">
            A tournament bracket will appear here once it&apos;s been set up.
          </p>
        </div>
      </div>
    );
  }

  const statusBadge = STATUS_BADGES[tournament.status] || STATUS_BADGES.SETUP;
  const totalTeams = tournament.teams?.length || 0;
  const totalMatches = tournament.matches?.length || 0;
  const completedMatches =
    tournament.matches?.filter((m: TournamentMatch) => m.status === "COMPLETED").length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[1400px] mx-auto px-6 py-6 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue text-white shadow-sm">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
              <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
            </div>
            {tournament.description && (
              <p className="text-sm text-brand-grey mt-0.5">{tournament.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100">
            <Users className="w-3.5 h-3.5 text-brand-grey" />
            <span className="text-xs font-semibold text-gray-700">{totalTeams} Teams</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100">
            <Swords className="w-3.5 h-3.5 text-brand-grey" />
            <span className="text-xs font-semibold text-gray-700">
              {completedMatches}/{totalMatches} Matches
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100">
            <Medal className="w-3.5 h-3.5 text-brand-grey" />
            <span className="text-xs font-semibold text-gray-700">4 Regions</span>
          </div>
        </div>
      </div>

      {/* Tournament selector */}
      {tournaments.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {tournaments.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                t.id === tournament.id
                  ? "bg-brand-blue text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
        <UnifiedTournamentBracket
          matchesByDivision={matchesByDivision}
          teamsByDivision={teamsByDivision}
          allMatches={tournament.matches || []}
        />
      </motion.div>
    </motion.div>
  );
}
