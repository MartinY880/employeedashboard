// ProConnect — useStats Hook
// Fetches dashboard stat counts from /api/stats with SWR-style pattern

"use client";

import { useState, useEffect, useCallback } from "react";
import type { DashboardStats } from "@/types";

const DEFAULT_STATS: DashboardStats = {
  upcomingHolidays: 0,
  teamMembers: 0,
  activeAlerts: 0,
  kudosThisMonth: 0,
};

export function useStats() {
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error(`Stats API returned ${res.status}`);

      const data: DashboardStats = await res.json();
      setStats(data);
    } catch (err) {
      console.error("[useStats] Failed to fetch:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStats, 60_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
