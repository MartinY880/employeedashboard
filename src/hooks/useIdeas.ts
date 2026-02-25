// ProConnect — useIdeas Hook
// Ideas data fetching + voting + optimistic updates

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Idea } from "@/types";

type VoteDirection = "up" | "down";

export function useIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [votedIdeaIds, setVotedIdeaIds] = useState<string[]>([]);
  const [userVotesByIdea, setUserVotesByIdea] = useState<Record<string, VoteDirection>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchIdeas = useCallback(async () => {
    try {
      const res = await fetch("/api/ideas");
      const data = await res.json();
      setIdeas(data.ideas || []);
      setVotedIdeaIds(data.votedIdeaIds || []);
      setUserVotesByIdea(data.userVotesByIdea || {});
    } catch (error) {
      console.error("Failed to fetch ideas:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  const submitIdea = useCallback(
    async (title: string, description: string, authorName?: string) => {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, authorName }),
      });

      if (!res.ok) throw new Error("Failed to submit idea");

      const data = await res.json();
      if (data.idea) {
        setIdeas((prev) => [data.idea, ...prev]);
      }
      return data.idea;
    },
    []
  );

  const voteIdea = useCallback(
    async (id: string, direction: "up" | "down") => {
      const currentVote = userVotesByIdea[id];
      const nextVote = currentVote === direction ? null : direction;

      const getDelta = (fromVote?: VoteDirection, toVote?: VoteDirection | null) => {
        const from = fromVote ?? null;
        const to = toVote ?? null;
        if (from === to) return 0;
        if (from === null && to === "up") return 1;
        if (from === null && to === "down") return -1;
        if (from === "up" && to === null) return -1;
        if (from === "down" && to === null) return 1;
        if (from === "up" && to === "down") return -2;
        if (from === "down" && to === "up") return 2;
        return 0;
      };

      const delta = getDelta(currentVote, nextVote);

      // Optimistic update
      setIdeas((prev) =>
        prev.map((idea) =>
          idea.id === id
            ? { ...idea, votes: idea.votes + delta }
            : idea
        )
      );
      setUserVotesByIdea((prev) => {
        const next = { ...prev };
        if (nextVote === null) {
          delete next[id];
        } else {
          next[id] = nextVote;
        }
        return next;
      });
      setVotedIdeaIds((prev) => {
        if (nextVote === null) return prev.filter((ideaId) => ideaId !== id);
        return prev.includes(id) ? prev : [...prev, id];
      });

      try {
        const res = await fetch("/api/ideas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, vote: direction }),
        });

        if (!res.ok) {
          // Revert on failure
          setIdeas((prev) =>
            prev.map((idea) =>
              idea.id === id
                ? { ...idea, votes: idea.votes - delta }
                : idea
            )
          );
          setUserVotesByIdea((prev) => {
            const next = { ...prev };
            if (!currentVote) {
              delete next[id];
            } else {
              next[id] = currentVote;
            }
            return next;
          });
          setVotedIdeaIds((prev) => {
            if (!currentVote) return prev.filter((ideaId) => ideaId !== id);
            return prev.includes(id) ? prev : [...prev, id];
          });
          return false;
        }
        return true;
      } catch {
        // Revert on error
        setIdeas((prev) =>
          prev.map((idea) =>
            idea.id === id
              ? { ...idea, votes: idea.votes - delta }
              : idea
          )
        );
        setUserVotesByIdea((prev) => {
          const next = { ...prev };
          if (!currentVote) {
            delete next[id];
          } else {
            next[id] = currentVote;
          }
          return next;
        });
        setVotedIdeaIds((prev) => {
          if (!currentVote) return prev.filter((ideaId) => ideaId !== id);
          return prev.includes(id) ? prev : [...prev, id];
        });
        return false;
      }
    },
    [userVotesByIdea]
  );

  const updateIdeaStatus = useCallback(
    async (id: string, status: "ACTIVE" | "SELECTED" | "ARCHIVED") => {
      const res = await fetch("/api/ideas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      if (!res.ok) throw new Error("Failed to update idea status");

      const data = await res.json();
      if (data.idea) {
        setIdeas((prev) =>
          prev.map((idea) => (idea.id === id ? data.idea : idea))
        );
      }
      return data.idea;
    },
    []
  );

  const deleteIdea = useCallback(async (id: string) => {
    const res = await fetch(`/api/ideas?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete idea");
    setIdeas((prev) => prev.filter((idea) => idea.id !== id));
  }, []);

  return {
    ideas,
    isLoading,
    submitIdea,
    voteIdea,
    votedIdeaIds,
    userVotesByIdea,
    updateIdeaStatus,
    deleteIdea,
    refetch: fetchIdeas,
  };
}
