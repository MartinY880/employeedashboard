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
  businessPhone?: string | null;
  mobilePhone?: string | null;
  faxNumber?: string | null;
  managerId?: string | null;
  photoUrl?: string;
  directReports?: DirectoryNode[];
}

export interface DirectoryBranch {
  id: string;
  name: string;
  sortOrder: number;
  memberIds: string[]; // Azure Object IDs of direct reports assigned to this branch
}

export interface DirectoryConfig {
  rootUserId: string | null;
  rootEmail: string | null;
  rootName: string | null;
  sharedEmployeeTypes?: string[];
}

export function useDirectory(mode: "tree" | "flat" = "tree") {
  const [users, setUsers] = useState<DirectoryNode[]>([]);
  const [branches, setBranches] = useState<DirectoryBranch[]>([]);
  const [config, setConfig] = useState<DirectoryConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDirectory = useCallback(async (bustCache = false) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/directory?mode=${mode}`, {
        cache: bustCache ? "no-store" : "default",
      });
      if (!res.ok) throw new Error(`Directory API returned ${res.status}`);
      const data = await res.json();
      setUsers(data.users || []);
      setBranches(data.branches || []);
      setConfig(data.config || null);
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

  return { users, branches, config, isLoading, error, refetch: () => fetchDirectory(true) };
}
