// ProConnect — 404 Not Found Page

import Link from "next/link";
import { Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-blue/10 mx-auto mb-6">
          <Search className="w-10 h-10 text-brand-blue/60" />
        </div>
        <h1 className="text-6xl font-bold text-brand-blue mb-2">404</h1>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Page Not Found
        </h2>
        <p className="text-sm text-brand-grey mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Button asChild className="bg-brand-blue hover:bg-brand-blue/90">
          <Link href="/dashboard">
            <Home className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
