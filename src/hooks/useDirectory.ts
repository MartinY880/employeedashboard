// ProConnect — useDirectory Hook
// Fetches org hierarchy from /api/directory, supports tree and flat modes

"use client";

import { useState, useEffect, useCallback } from "react";

export interface DirectoryNode {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle: string | null;
  employeeType?: string | null;
  department: string | null;
  officeLocation: string | null;
  photoUrl?: string;
  directReports?: DirectoryNode[];
}

export function useDirectory(mode: "tree" | "flat" = "tree") {
  const [users, setUsers] = useState<DirectoryNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDirectory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/directory?mode=${mode}`);
      if (!res.ok) throw new Error(`Directory API returned ${res.status}`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Failed to fetch directory:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch directory");
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  return { users, isLoading, error, refetch: fetchDirectory };
}
