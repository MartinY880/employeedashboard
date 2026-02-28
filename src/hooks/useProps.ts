// ProConnect — useProps Hook
// Props data fetching + optimistic updates

"use client";

import { useState, useEffect, useCallback } from "react";
import type { PropsMessage } from "@/types";

interface PropsResponse {
  props?: PropsMessage[];
  currentUserId?: string | null;
}

export function useProps() {
  const [props, setProps] = useState<PropsMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchProps = useCallback(async () => {
    try {
      const res = await fetch("/api/props");
      const data: PropsResponse = await res.json();
      setProps(data.props || []);
      setCurrentUserId(data.currentUserId ?? null);
    } catch (error) {
      console.error("Failed to fetch props:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProps();
  }, [fetchProps]);

  const sendProps = useCallback(
    async (recipientId: string, content: string, recipientName?: string, badge?: string) => {
      const res = await fetch("/api/props", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, content, recipientName, badge }),
      });

      if (!res.ok) {
        throw new Error("Failed to send props");
      }

      const data = await res.json();

      // Prepend the new props to the list immediately
      if (data.props) {
        setProps((prev) => [data.props, ...prev]);
      }

      // Signal notification system to refetch (recipient gets a notification)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("notifications-updated"));
      }

      return data.props;
    },
    []
  );

  const toggleReaction = useCallback(
    async (propsId: string, reaction: "highfive" | "uplift" | "bomb") => {
      const res = await fetch("/api/props", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propsId, reaction }),
      });

      if (!res.ok) {
        throw new Error("Failed to toggle reaction");
      }

      const data: {
        propsId: string;
        reactions: { highfive: number; uplift: number; bomb: number };
        myReactions: Array<"highfive" | "uplift" | "bomb">;
      } = await res.json();

      setProps((prev) =>
        prev.map((item) =>
          item.id === data.propsId
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

  return { props, currentUserId, isLoading, sendProps, toggleReaction, refetch: fetchProps };
}
