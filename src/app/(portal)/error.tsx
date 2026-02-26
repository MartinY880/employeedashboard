// ProConnect — Portal Error Page
// Next.js App Router error boundary for portal routes

"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ProConnect Portal Error]", error);
  }, [error]);

  return (
    <div className="max-w-md mx-auto px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 mx-auto mb-6">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-brand-grey mb-6">
        An unexpected error occurred while loading this page. Please try again.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button onClick={reset} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Try Again
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">
            <Home className="w-4 h-4 mr-1.5" />
            Dashboard
          </Link>
        </Button>
      </div>
      {error.digest && (
        <p className="text-[10px] text-brand-grey/50 mt-6">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
