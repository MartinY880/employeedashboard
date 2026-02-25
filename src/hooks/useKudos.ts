// ProConnect — useKudos Hook
// Kudos data fetching + optimistic updates

"use client";

import { useState, useEffect, useCallback } from "react";
import type { KudosMessage } from "@/types";

export function useKudos() {
  const [kudos, setKudos] = useState<KudosMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchKudos = useCallback(async () => {
    try {
      const res = await fetch("/api/kudos");
      const data = await res.json();
      setKudos(data.kudos || []);
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

  return { kudos, isLoading, sendKudos, refetch: fetchKudos };
}
