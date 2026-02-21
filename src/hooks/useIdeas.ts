// ProConnect — useIdeas Hook
// Ideas data fetching + voting + optimistic updates

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Idea } from "@/types";

export function useIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchIdeas = useCallback(async () => {
    try {
      const res = await fetch("/api/ideas");
      const data = await res.json();
      setIdeas(data.ideas || []);
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
      // Optimistic update
      setIdeas((prev) =>
        prev.map((idea) =>
          idea.id === id
            ? { ...idea, votes: idea.votes + (direction === "up" ? 1 : -1) }
            : idea
        )
      );

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
                ? { ...idea, votes: idea.votes + (direction === "up" ? -1 : 1) }
                : idea
            )
          );
        }
      } catch {
        // Revert on error
        setIdeas((prev) =>
          prev.map((idea) =>
            idea.id === id
              ? { ...idea, votes: idea.votes + (direction === "up" ? -1 : 1) }
              : idea
          )
        );
      }
    },
    []
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
    updateIdeaStatus,
    deleteIdea,
    refetch: fetchIdeas,
  };
}
