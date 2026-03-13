// ProConnect — Our Standards Page
// Dedicated page for company pillars / core values with collage background

import { StatsRow } from "@/components/widgets/StatsRow";
import { CollageBackground } from "@/components/widgets/CollageBackground";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

export default function OurStandardsPage() {
  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden">
      <CollageBackground />
      <div className="relative z-10 max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-14 py-4 sm:py-6">
        <ErrorBoundary label="Our Standards" compact>
          <StatsRow />
        </ErrorBoundary>
      </div>
    </div>
  );
}
