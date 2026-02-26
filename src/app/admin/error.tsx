// ProConnect — Admin Error Page

"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ProConnect Admin Error]", error);
  }, [error]);

  return (
    <div className="max-w-md mx-auto px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 mx-auto mb-6">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Admin Error</h2>
      <p className="text-sm text-brand-grey mb-6">
        Something went wrong in the admin panel.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button onClick={reset} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Try Again
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Admin Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
