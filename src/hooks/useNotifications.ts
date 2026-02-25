// ProConnect — useNotifications Hook
// Polls for unread notifications and provides actions

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface Notification {
  id: string;
  userId: string;
  type: "KUDOS" | "HIGHLIGHT" | "IDEA_SELECTED";
  title: string;
  message: string;
  read: boolean;
  metadata: string | null;
  createdAt: string;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
}

const POLL_INTERVAL = 15_000; // 15 seconds

export function useNotifications() {
  const [state, setState] = useState<NotificationsState>({
    notifications: [],
    unreadCount: 0,
    isLoading: true,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setState({
        notifications: data.notifications || [],
        unreadCount: data.unreadCount || 0,
        isLoading: false,
      });
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const markAsRead = useCallback(async (ids: string[]) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setState((prev) => ({
        ...prev,
        unreadCount: data.unreadCount ?? prev.unreadCount,
        notifications: prev.notifications.map((n) =>
          ids.includes(n.id) ? { ...n, read: true } : n
        ),
      }));
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) return;
      setState((prev) => ({
        ...prev,
        unreadCount: 0,
        notifications: prev.notifications.map((n) => ({ ...n, read: true })),
      }));
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { method: "DELETE" });
      if (!res.ok) return;
      setState((prev) => ({
        ...prev,
        notifications: [],
        unreadCount: 0,
      }));
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  }, []);

  // Initial fetch + polling + listen for custom event
  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL);

    // Instant refetch when any component dispatches this event
    const handler = () => {
      // Small delay to let the server-side notification be created
      setTimeout(fetchNotifications, 1500);
    };
    window.addEventListener("notifications-updated", handler);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("notifications-updated", handler);
    };
  }, [fetchNotifications]);

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    isLoading: state.isLoading,
    markAsRead,
    markAllAsRead,
    clearAll,
    refetch: fetchNotifications,
  };
}
