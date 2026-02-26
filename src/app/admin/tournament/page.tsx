// ProConnect — Admin Tournament Management Page
// Full CRUD for tournaments, teams, and match results

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Trophy,
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Users,
  Swords,
  Crown,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  X,
  Play,
  Square,
  Medal,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSounds } from "@/components/shared/SoundProvider";
import { useTournament } from "@/hooks/useTournament";
import type { TournamentMatch, TournamentTeam } from "@/types";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const DIVISIONS = ["Region 1", "Region 2", "Region 3", "Region 4"] as const;

const DIVISION_COLORS: Record<string, string> = {
  "Region 1": "bg-blue-100 text-blue-700",
  "Region 2": "bg-emerald-100 text-emerald-700",
  "Region 3": "bg-amber-100 text-amber-700",
  "Region 4": "bg-purple-100 text-purple-700",
};

const STATUS_STYLES: Record<string, string> = {
  SETUP: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};

const NO_WINNER = "__NONE__";

/* ------------------------------------------------------------------ */
/* Main Admin Page                                                     */
/* ------------------------------------------------------------------ */

export default function AdminTournamentPage() {
  const { playClick, playSuccess, playNotify } = useSounds();
  const { tournaments, isLoading: listLoading, deleteTournament, createTournament, fetchTournaments } = useTournament();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Dashboard visibility toggle
  const [showOnDashboard, setShowOnDashboard] = useState<boolean | null>(null);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  useEffect(() => {
    async function fetchVisibility() {
      try {
        const res = await fetch("/api/dashboard-settings/visibility");
        if (res.ok) {
          const data = await res.json();
          setShowOnDashboard(data.showTournamentBracketLive !== false);
        }
      } catch { /* keep null */ }
    }
    fetchVisibility();
  }, []);

  async function toggleVisibility() {
    const next = !showOnDashboard;
    setTogglingVisibility(true);
    try {
      const res = await fetch("/api/dashboard-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "showTournamentBracketLive", value: next }),
      });
      if (res.ok) {
        setShowOnDashboard(next);
        toast.success(next ? "Tournament Banner shown on dashboard" : "Tournament Banner hidden from dashboard");
      } else {
        toast.error("Failed to update visibility");
      }
    } catch {
      toast.error("Failed to update visibility");
    } finally {
      setTogglingVisibility(false);
    }
  }

  // If a tournament is selected, show the detail view
  if (selectedTournamentId) {
    return (
      <TournamentDetail
        tournamentId={selectedTournamentId}
        onBack={() => {
          setSelectedTournamentId(null);
          fetchTournaments();
        }}
      />
    );
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createTournament(newName, newDesc);
      playSuccess();
      setShowCreateDialog(false);
      setNewName("");
      setNewDesc("");
      fetchTournaments();
    } catch {
      playNotify();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteTournament(deleteTarget);
      playNotify();
      setDeleteTarget(null);
    } catch {
      // silent
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[1200px] mx-auto px-6 py-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-brand-grey" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue text-white">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Tournament Management</h1>
            <p className="text-xs text-brand-grey">
              {tournaments.length} tournament{tournaments.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleVisibility}
            disabled={showOnDashboard === null || togglingVisibility}
            className={showOnDashboard === false ? "border-red-200 text-red-600 hover:bg-red-50" : ""}
          >
            {showOnDashboard === null || togglingVisibility ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : showOnDashboard ? (
              <Eye className="w-4 h-4 mr-1.5" />
            ) : (
              <EyeOff className="w-4 h-4 mr-1.5" />
            )}
            {showOnDashboard === null ? "Loading…" : showOnDashboard ? "Banner Visible" : "Banner Hidden"}
          </Button>
          <Button
            onClick={() => {
              playClick();
              setShowCreateDialog(true);
            }}
            className="bg-brand-blue hover:bg-brand-blue/90"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Tournament
          </Button>
        </div>
      </div>

      {/* Tournament List */}
      {listLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <Trophy className="w-8 h-8 text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">No Tournaments</h2>
          <p className="text-sm text-brand-grey mb-4">Create your first tournament bracket to get started.</p>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-brand-blue hover:bg-brand-blue/90"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create Tournament
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t, i) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tAny = t as any;
            const teamCount = tAny._count ? tAny._count.teams : (t.teams?.length || 0);
            const matchCount = tAny._count ? tAny._count.matches : (t.matches?.length || 0);

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 hover:shadow-md hover:border-brand-blue/20 transition-all cursor-pointer group"
                onClick={() => {
                  playClick();
                  setSelectedTournamentId(t.id);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-800 dark:text-gray-200 group-hover:text-brand-blue transition-colors">
                          {t.name}
                        </h3>
                        <Badge className={STATUS_STYLES[t.status]}>{t.status.replace("_", " ")}</Badge>
                      </div>
                      {t.description && (
                        <p className="text-xs text-brand-grey mt-0.5">{t.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {teamCount} teams
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <Swords className="w-3 h-3" /> {matchCount} matches
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(t.id);
                      }}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tournament</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. MortgagePros 2026 Tournament"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Description</label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional description..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="bg-brand-blue hover:bg-brand-blue/90"
            >
              {creating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tournament?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-brand-grey">
            This will permanently delete the tournament, all teams, and all match results.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Tournament Detail View                                              */
/* ------------------------------------------------------------------ */

function TournamentDetail({
  tournamentId,
  onBack,
}: {
  tournamentId: string;
  onBack: () => void;
}) {
  const { playClick, playSuccess, playNotify } = useSounds();
  const {
    tournament,
    isLoading,
    updateTournament,
    updateMatch,
    addTeam,
    removeTeam,
    refetch,
  } = useTournament(tournamentId);

  const [activeTab, setActiveTab] = useState<"teams" | "matches">("teams");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newPlayer1, setNewPlayer1] = useState("");
  const [newPlayer2, setNewPlayer2] = useState("");
  const [newDivision, setNewDivision] = useState<string>("Region 1");
  const [addingTeam, setAddingTeam] = useState(false);
  const [editingMatch, setEditingMatch] = useState<TournamentMatch | null>(null);
  const [matchWinner, setMatchWinner] = useState<string>(NO_WINNER);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [savingMatch, setSavingMatch] = useState(false);
  const [quickSavingMatchId, setQuickSavingMatchId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const filteredTeams = useMemo(() => {
    if (!tournament?.teams) return [];
    if (divisionFilter === "all") return tournament.teams;
    return tournament.teams.filter((t) => t.division === divisionFilter);
  }, [tournament?.teams, divisionFilter]);

  const filteredMatches = useMemo(() => {
    if (!tournament?.matches) return [];
    if (divisionFilter === "all") return tournament.matches;
    return tournament.matches.filter((m) => m.division === divisionFilter);
  }, [tournament?.matches, divisionFilter]);

  const handleAddTeam = useCallback(async () => {
    if (!newPlayer1.trim() || !newPlayer2.trim()) return;
    setAddingTeam(true);
    try {
      await addTeam({
        tournamentId,
        player1Name: newPlayer1,
        player2Name: newPlayer2,
        division: newDivision,
      });
      playSuccess();
      setNewPlayer1("");
      setNewPlayer2("");
      setShowAddTeam(false);
      refetch();
    } catch {
      playNotify();
    } finally {
      setAddingTeam(false);
    }
  }, [newPlayer1, newPlayer2, newDivision, tournamentId, addTeam, playSuccess, playNotify, refetch]);

  const handleRemoveTeam = useCallback(async (teamId: string) => {
    try {
      await removeTeam(teamId);
      playNotify();
      refetch();
    } catch {
      // silent
    }
  }, [removeTeam, playNotify, refetch]);

  const handleSaveMatch = useCallback(async () => {
    if (!editingMatch) return;
    setSavingMatch(true);
    try {
      const winnerId = matchWinner === NO_WINNER ? null : matchWinner;
      await updateMatch(
        editingMatch.id,
        winnerId,
        score1 ? parseInt(score1) : undefined,
        score2 ? parseInt(score2) : undefined
      );
      playSuccess();
      setEditingMatch(null);
      setMatchWinner(NO_WINNER);
      setScore1("");
      setScore2("");
      refetch();
    } catch {
      playNotify();
    } finally {
      setSavingMatch(false);
    }
  }, [editingMatch, matchWinner, score1, score2, updateMatch, playSuccess, playNotify, refetch]);

  const handleQuickPickWinner = useCallback(async (match: TournamentMatch, winnerId: string) => {
    setQuickSavingMatchId(match.id);
    try {
      const nextWinnerId = match.winnerId === winnerId ? null : winnerId;
      await updateMatch(match.id, nextWinnerId);
      playSuccess();
      refetch();
    } catch {
      playNotify();
    } finally {
      setQuickSavingMatchId(null);
    }
  }, [updateMatch, playSuccess, playNotify, refetch]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await updateTournament(tournamentId, { status: newStatus });
      playSuccess();
    } catch {
      playNotify();
    } finally {
      setUpdatingStatus(false);
    }
  }, [tournamentId, updateTournament, playSuccess, playNotify]);

  if (isLoading) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-5">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <p className="text-center text-brand-grey mt-10">Tournament not found.</p>
      </div>
    );
  }

  const teamsByDiv: Record<string, TournamentTeam[]> = {};
  for (const t of tournament.teams || []) {
    if (!teamsByDiv[t.division]) teamsByDiv[t.division] = [];
    teamsByDiv[t.division].push(t);
  }

  const matchesByDiv: Record<string, TournamentMatch[]> = {};
  for (const m of tournament.matches || []) {
    if (!matchesByDiv[m.division]) matchesByDiv[m.division] = [];
    matchesByDiv[m.division].push(m);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[1200px] mx-auto px-6 py-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-brand-grey" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue text-white">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{tournament.name}</h1>
              <Badge className={STATUS_STYLES[tournament.status]}>{tournament.status.replace("_", " ")}</Badge>
            </div>
            <p className="text-xs text-brand-grey">
              {tournament.teams?.length || 0} teams · {tournament.matches?.length || 0} matches
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={tournament.status}
            onValueChange={(val) => handleStatusChange(val)}
            disabled={updatingStatus}
          >
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SETUP">Setup</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tab + Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { playClick(); setActiveTab("teams"); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === "teams" ? "bg-brand-blue text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-200"
            }`}
          >
            <Users className="w-3.5 h-3.5 inline mr-1" />
            Teams
          </button>
          <button
            onClick={() => { playClick(); setActiveTab("matches"); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === "matches" ? "bg-brand-blue text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-200"
            }`}
          >
            <Swords className="w-3.5 h-3.5 inline mr-1" />
            Matches
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={divisionFilter} onValueChange={setDivisionFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Division" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {DIVISIONS.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeTab === "teams" && (
            <Button
              size="sm"
              onClick={() => { playClick(); setShowAddTeam(true); }}
              className="bg-brand-blue hover:bg-brand-blue/90 text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Team
            </Button>
          )}
        </div>
      </div>

      {/* Teams Table */}
      {activeTab === "teams" && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Player 1</TableHead>
                <TableHead>Player 2</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Seed</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-brand-grey">
                    No teams in this division. Add teams to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTeams.map((team, idx) => (
                  <TableRow key={team.id} className="group">
                    <TableCell className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-mono">{idx + 1}</TableCell>
                    <TableCell className="font-medium text-sm">{team.player1Name}</TableCell>
                    <TableCell className="font-medium text-sm">{team.player2Name}</TableCell>
                    <TableCell>
                      <Badge className={DIVISION_COLORS[team.division] || "bg-gray-100 dark:bg-gray-800"}>
                        {team.division}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{team.seed}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTeam(team.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Division summaries */}
          <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-4 flex-wrap bg-gray-50 dark:bg-gray-800">
            {DIVISIONS.map((d) => (
              <div key={d} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                <Badge className={`${DIVISION_COLORS[d]} text-[10px] px-1.5 py-0`}>{d}</Badge>
                <span>{teamsByDiv[d]?.length || 0} teams</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matches Table */}
      {activeTab === "matches" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Match</TableHead>
                <TableHead>Team 1</TableHead>
                <TableHead className="w-8 text-center">vs</TableHead>
                <TableHead>Team 2</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Round</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Winner</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-brand-grey">
                    No matches found. Matches are created automatically when the tournament starts.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMatches.map((match) => {
                  const isBye = !match.team2Id && match.winnerId === match.team1Id;
                  return (
                    <TableRow key={match.id} className="group">
                      <TableCell className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-mono">{match.matchNumber}</TableCell>
                      <TableCell className="text-sm">
                        {match.team1 ? (
                          <button
                            onClick={() => {
                              if (!isBye && match.team2) {
                                playClick();
                                handleQuickPickWinner(match, match.team1!.id);
                              }
                            }}
                            disabled={!match.team2 || isBye || quickSavingMatchId === match.id || savingMatch}
                            className={`w-full text-left rounded-md px-1.5 py-1 transition-colors ${
                              !match.team2 || isBye
                                ? "cursor-not-allowed"
                                : "hover:bg-emerald-50"
                            }`}
                            title={!match.team2 || isBye ? "No opponent yet" : "Set Team 1 as winner"}
                          >
                            <div className={`flex items-center gap-1 ${match.winnerId === match.team1Id ? "font-bold text-emerald-700" : ""}`}>
                              {quickSavingMatchId === match.id && match.winnerId !== match.team1Id ? (
                                <Loader2 className="w-3 h-3 text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 animate-spin" />
                              ) : match.winnerId === match.team1Id ? (
                                <Crown className="w-3 h-3 text-amber-500" />
                              ) : null}
                              {`${match.team1.player1Name} / ${match.team1.player2Name}`}
                            </div>
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">TBD</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">vs</TableCell>
                      <TableCell className="text-sm">
                        {isBye ? (
                          <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 italic">BYE</span>
                        ) : match.team2 ? (
                          <button
                            onClick={() => {
                              playClick();
                              handleQuickPickWinner(match, match.team2!.id);
                            }}
                            disabled={quickSavingMatchId === match.id || savingMatch}
                            className="w-full text-left rounded-md px-1.5 py-1 transition-colors hover:bg-emerald-50"
                            title="Set Team 2 as winner"
                          >
                            <div className={`flex items-center gap-1 ${match.winnerId === match.team2Id ? "font-bold text-emerald-700" : ""}`}>
                              {quickSavingMatchId === match.id && match.winnerId !== match.team2Id ? (
                                <Loader2 className="w-3 h-3 text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 animate-spin" />
                              ) : match.winnerId === match.team2Id ? (
                                <Crown className="w-3 h-3 text-amber-500" />
                              ) : null}
                              {`${match.team2.player1Name} / ${match.team2.player2Name}`}
                            </div>
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 italic">TBD</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={DIVISION_COLORS[match.division] || "bg-gray-100 dark:bg-gray-800"}>
                          {match.division}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">R{match.round}</TableCell>
                      <TableCell className="text-sm font-mono text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                        {match.team1Score !== null && match.team2Score !== null
                          ? `${match.team1Score} - ${match.team2Score}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {match.winner ? (
                          <span className="text-emerald-700 font-medium text-xs">
                            {match.winner.player1Name} / {match.winner.player2Name}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!isBye && match.team1 && match.team2 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              playClick();
                              setEditingMatch(match);
                              setMatchWinner(match.winnerId || NO_WINNER);
                              setScore1(match.team1Score?.toString() || "");
                              setScore2(match.team2Score?.toString() || "");
                            }}
                            className="opacity-0 group-hover:opacity-100 text-brand-blue hover:text-brand-blue hover:bg-blue-50 h-7 w-7 p-0"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Add Team Dialog */}
      <Dialog open={showAddTeam} onOpenChange={setShowAddTeam}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Player 1 Name</label>
              <Input
                value={newPlayer1}
                onChange={(e) => setNewPlayer1(e.target.value)}
                placeholder="First player name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Player 2 Name</label>
              <Input
                value={newPlayer2}
                onChange={(e) => setNewPlayer2(e.target.value)}
                placeholder="Second player name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Division</label>
              <Select value={newDivision} onValueChange={setNewDivision}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIVISIONS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTeam(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddTeam}
              disabled={!newPlayer1.trim() || !newPlayer2.trim() || addingTeam}
              className="bg-brand-blue hover:bg-brand-blue/90"
            >
              {addingTeam && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Add Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Match Dialog */}
      <Dialog open={!!editingMatch} onOpenChange={() => setEditingMatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Match Result</DialogTitle>
          </DialogHeader>
          {editingMatch && (
            <div className="space-y-4 py-2">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">
                  {editingMatch.division} Region · Round {editingMatch.round} · Match {editingMatch.matchNumber}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {editingMatch.team1?.player1Name} / {editingMatch.team1?.player2Name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mx-2">vs</span>
                  <span className="text-sm font-medium">
                    {editingMatch.team2?.player1Name} / {editingMatch.team2?.player2Name}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Winner</label>
                <Select value={matchWinner} onValueChange={setMatchWinner}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select winner..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_WINNER}>Unselect winner</SelectItem>
                    {editingMatch.team1 && (
                      <SelectItem value={editingMatch.team1.id}>
                        {editingMatch.team1.player1Name} / {editingMatch.team1.player2Name}
                      </SelectItem>
                    )}
                    {editingMatch.team2 && (
                      <SelectItem value={editingMatch.team2.id}>
                        {editingMatch.team2.player1Name} / {editingMatch.team2.player2Name}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Team 1 Score
                  </label>
                  <Input
                    type="number"
                    value={score1}
                    onChange={(e) => setScore1(e.target.value)}
                    placeholder="0"
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Team 2 Score
                  </label>
                  <Input
                    type="number"
                    value={score2}
                    onChange={(e) => setScore2(e.target.value)}
                    placeholder="0"
                    min={0}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMatch(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveMatch}
              disabled={savingMatch}
              className="bg-brand-blue hover:bg-brand-blue/90"
            >
              {savingMatch && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              <Check className="w-4 h-4 mr-1" />
              Save Result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
