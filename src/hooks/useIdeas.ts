// ProConnect — useIdeas Hook
// Ideas data fetching + voting + optimistic updates

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Idea } from "@/types";

type VoteDirection = "up" | "down";
type VoteState = VoteDirection | null;

export function useIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [votedIdeaIds, setVotedIdeaIds] = useState<string[]>([]);
  const [userVotesByIdea, setUserVotesByIdea] = useState<Record<string, VoteState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const pendingVoteIdsRef = useRef<Set<string>>(new Set());

  const fetchIdeas = useCallback(async () => {
    try {
      const res = await fetch("/api/ideas");
      const data = await res.json();
      setIdeas(data.ideas || []);
      setVotedIdeaIds(data.votedIdeaIds || []);
      setUserVotesByIdea((data.userVotesByIdea || {}) as Record<string, VoteState>);
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
      if (pendingVoteIdsRef.current.has(id)) return false;

      const previousVote: VoteState = userVotesByIdea[id] ?? null;
      let nextVote: VoteState = null;
      let delta = 0;

      if (direction === "up") {
        if (previousVote === "up") {
          nextVote = null;
          delta = -1;
        } else if (previousVote === "down") {
          nextVote = "up";
          delta = 2;
        } else {
          nextVote = "up";
          delta = 1;
        }
      } else {
        if (previousVote === "down") {
          nextVote = null;
          delta = 1;
        } else if (previousVote === "up") {
          nextVote = "down";
          delta = -2;
        } else {
          nextVote = "down";
          delta = -1;
        }
      }

      if (delta === 0) return false;
      pendingVoteIdsRef.current.add(id);

      setIdeas((prev) =>
        prev.map((idea) =>
          idea.id === id
            ? { ...idea, votes: idea.votes + delta }
            : idea
        )
      );
      setUserVotesByIdea((prev) => {
        const next = { ...prev } as Record<string, VoteState>;
        if (nextVote) next[id] = nextVote;
        else delete next[id];
        return next;
      });
      setVotedIdeaIds((prev) => {
        if (nextVote) {
          return prev.includes(id) ? prev : [...prev, id];
        }
        return prev.filter((ideaId) => ideaId !== id);
      });

      try {
        const res = await fetch("/api/ideas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, vote: direction }),
        });

        if (!res.ok) {
          setIdeas((prev) =>
            prev.map((idea) =>
              idea.id === id
                ? { ...idea, votes: idea.votes - delta }
                : idea
            )
          );
          setUserVotesByIdea((prev) => {
            const next = { ...prev } as Record<string, VoteState>;
            if (previousVote) next[id] = previousVote;
            else delete next[id];
            return next;
          });
          setVotedIdeaIds((prev) => {
            if (previousVote) {
              return prev.includes(id) ? prev : [...prev, id];
            }
            return prev.filter((ideaId) => ideaId !== id);
          });
          return false;
        }
        return true;
      } catch {
        setIdeas((prev) =>
          prev.map((idea) =>
            idea.id === id
              ? { ...idea, votes: idea.votes - delta }
              : idea
          )
        );
        setUserVotesByIdea((prev) => {
          const next = { ...prev } as Record<string, VoteState>;
          if (previousVote) next[id] = previousVote;
          else delete next[id];
          return next;
        });
        setVotedIdeaIds((prev) => {
          if (previousVote) {
            return prev.includes(id) ? prev : [...prev, id];
          }
          return prev.filter((ideaId) => ideaId !== id);
        });
        return false;
      } finally {
        pendingVoteIdsRef.current.delete(id);
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
