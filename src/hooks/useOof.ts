// ProConnect — useOof Hook
// Fetches OOF (Out of Office) status + email forwarding from the API

"use client";

import { useState, useEffect, useCallback } from "react";

export interface OofForwarding {
  enabled: boolean;
  forwardTo: string | null;
  forwardToName: string | null;
}

export interface OofData {
  status: "disabled" | "alwaysEnabled" | "scheduled";
  externalAudience: "none" | "contactsOnly" | "all";
  scheduledStartDateTime: string | null;
  scheduledEndDateTime: string | null;
  internalReplyMessage: string | null;
  externalReplyMessage: string | null;
  forwarding: OofForwarding | null;
}

export function useOof() {
  const [oof, setOof] = useState<OofData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOof = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/ooo");
      const data = await res.json();
      setOof(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch OOF status:", err);
      setError("Failed to load OOF status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setOofStatus = useCallback(async (settings: Partial<OofData> & {
    forwardToEmail?: string;
    forwardToName?: string;
    removeForwarding?: boolean;
  }) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ooo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update OOF settings");
      }
      setOof(data);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const disableOof = useCallback(async () => {
    return setOofStatus({ status: "disabled" });
  }, [setOofStatus]);

  useEffect(() => {
    fetchOof();
  }, [fetchOof]);

  return {
    oof,
    isLoading,
    isSaving,
    error,
    setOofStatus,
    disableOof,
    refetch: fetchOof,
  };
}
