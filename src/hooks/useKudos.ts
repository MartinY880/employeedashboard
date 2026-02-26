// ProConnect — useKudos Hook
// Kudos data fetching + optimistic updates

"use client";

import { useState, useEffect, useCallback } from "react";
import type { KudosMessage } from "@/types";

interface KudosResponse {
  kudos?: KudosMessage[];
  currentUserId?: string | null;
}

export function useKudos() {
  const [kudos, setKudos] = useState<KudosMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchKudos = useCallback(async () => {
    try {
      const res = await fetch("/api/kudos");
      const data: KudosResponse = await res.json();
      setKudos(data.kudos || []);
      setCurrentUserId(data.currentUserId ?? null);
    } catch (error) {
      console.error("Failed to fetch kudos:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKudos();
  }, [fetchKudos]);

  const sendKudos = useCallback(
    async (recipientId: string, content: string, recipientName?: string, badge?: string) => {
      const res = await fetch("/api/kudos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, content, recipientName, badge }),
      });

      if (!res.ok) {
        throw new Error("Failed to send kudos");
      }

      const data = await res.json();

      // Prepend the new kudos to the list immediately
      if (data.kudos) {
        setKudos((prev) => [data.kudos, ...prev]);
      }

      // Signal notification system to refetch (recipient gets a notification)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("notifications-updated"));
      }

      return data.kudos;
    },
    []
  );

  const toggleReaction = useCallback(
    async (kudosId: string, reaction: "highfive" | "uplift" | "bomb") => {
      const res = await fetch("/api/kudos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kudosId, reaction }),
      });

      if (!res.ok) {
        throw new Error("Failed to toggle reaction");
      }

      const data: {
        kudosId: string;
        reactions: { highfive: number; uplift: number; bomb: number };
        myReactions: Array<"highfive" | "uplift" | "bomb">;
      } = await res.json();

      setKudos((prev) =>
        prev.map((item) =>
          item.id === data.kudosId
            ? {
                ...item,
                reactions: data.reactions,
                myReactions: data.myReactions,
                likes: data.reactions.highfive,
              }
            : item
        )
      );

      return data;
    },
    []
  );

  return { kudos, currentUserId, isLoading, sendKudos, toggleReaction, refetch: fetchKudos };
}
