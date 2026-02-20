// ProConnect — Portal Loading State
// Shows skeleton shimmer while portal pages load

import { Skeleton } from "@/components/ui/skeleton";

export default function PortalLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-pulse">
      {/* Stats Row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] rounded-xl bg-brand-blue/10" />
        ))}
      </div>

      {/* 3-Column skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_340px] gap-5">
        <Skeleton className="h-[400px] rounded-xl" />
        <div className="space-y-5">
          <Skeleton className="h-[260px] rounded-xl" />
          <Skeleton className="h-[200px] rounded-xl" />
        </div>
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    </div>
  );
}
