// ProConnect — useTournament Hook
// Tournament data fetching + match updates

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Tournament, TournamentMatch } from "@/types";

export function useTournament(tournamentId?: string) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTournaments = useCallback(async () => {
    try {
      const res = await fetch("/api/tournaments");
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch (error) {
      console.error("Failed to fetch tournaments:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTournament = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tournaments?id=${id}`);
      const data = await res.json();
      setTournament(data.tournament || null);
    } catch (error) {
      console.error("Failed to fetch tournament:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tournamentId) {
      fetchTournament(tournamentId);
    } else {
      fetchTournaments();
    }
  }, [tournamentId, fetchTournament, fetchTournaments]);

  const updateMatch = useCallback(
    async (
      matchId: string,
      winnerId: string | null,
      team1Score?: number,
      team2Score?: number
    ): Promise<TournamentMatch | null> => {
      if (!tournament) return null;

      try {
        const res = await fetch("/api/tournaments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: tournament.id,
            action: "updateMatch",
            matchId,
            winnerId,
            team1Score,
            team2Score,
          }),
        });

        if (!res.ok) throw new Error("Failed to update match");

        const data = await res.json();

        // Update local state
        if (data.match && tournament.matches) {
          setTournament((prev) => {
            if (!prev || !prev.matches) return prev;
            return {
              ...prev,
              matches: prev.matches.map((m) =>
                m.id === matchId ? data.match : m
              ),
            };
          });
        }

        return data.match;
      } catch (error) {
        console.error("Failed to update match:", error);
        return null;
      }
    },
    [tournament]
  );

  const createTournament = useCallback(
    async (name: string, description?: string, teams?: { player1Name: string; player2Name: string; division: string; seed?: number }[]) => {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, teams }),
      });

      if (!res.ok) throw new Error("Failed to create tournament");

      const data = await res.json();
      if (data.tournament) {
        setTournaments((prev) => [data.tournament, ...prev]);
      }
      return data.tournament;
    },
    []
  );

  const updateTournament = useCallback(
    async (id: string, updates: { name?: string; description?: string; status?: string }) => {
      const res = await fetch("/api/tournaments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });

      if (!res.ok) throw new Error("Failed to update tournament");

      const data = await res.json();
      if (data.tournament) {
        setTournament(data.tournament);
        setTournaments((prev) =>
          prev.map((t) => (t.id === id ? data.tournament : t))
        );
      }
      return data.tournament;
    },
    []
  );

  const deleteTournament = useCallback(async (id: string) => {
    const res = await fetch(`/api/tournaments?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete tournament");
    setTournaments((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addTeam = useCallback(
    async (data: { tournamentId: string; player1Name: string; player2Name: string; division: string; seed?: number }) => {
      const res = await fetch("/api/tournaments/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add team");
      return (await res.json()).team;
    },
    []
  );

  const removeTeam = useCallback(async (teamId: string) => {
    const res = await fetch(`/api/tournaments/teams?id=${teamId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to remove team");
  }, []);

  return {
    tournaments,
    tournament,
    isLoading,
    fetchTournaments,
    fetchTournament,
    createTournament,
    updateTournament,
    deleteTournament,
    updateMatch,
    addTeam,
    removeTeam,
    refetch: tournamentId ? () => fetchTournament(tournamentId) : fetchTournaments,
  };
}
