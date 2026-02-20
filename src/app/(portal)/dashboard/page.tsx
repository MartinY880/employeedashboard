// ProConnect — Main Employee Dashboard
// Stats row + 3-column layout: Directory Tree | Calendar + OOO | Kudos/Alerts Feed

import { StatsRow } from "@/components/widgets/StatsRow";
import { DirectoryTree } from "@/components/widgets/DirectoryTree";
import { CalendarWidget } from "@/components/widgets/CalendarWidget";
import { OooWidget } from "@/components/widgets/OooWidget";
import { FeedPanel } from "@/components/widgets/FeedPanel";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

export default function DashboardPage() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
      {/* Stats Row */}
      <section className="mb-6">
        <ErrorBoundary label="Stats" compact>
          <StatsRow />
        </ErrorBoundary>
      </section>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_340px] gap-5 items-start">
        {/* Left: Directory Tree */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 border-t-[3px] border-t-brand-blue">
            <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">
              Directory
            </h3>
            <p className="text-[11px] text-brand-grey mt-0.5">Organization hierarchy</p>
          </div>
          <ErrorBoundary label="Directory" compact>
            <DirectoryTree />
          </ErrorBoundary>
        </div>

        {/* Center: Calendar + OOO */}
        <div className="space-y-5">
          {/* Calendar Widget */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 border-t-[3px] border-t-brand-blue">
              <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">
                Upcoming Holidays
              </h3>
              <p className="text-[11px] text-brand-grey mt-0.5">Company calendar</p>
            </div>
            <ErrorBoundary label="Calendar" compact>
              <CalendarWidget />
            </ErrorBoundary>
          </div>

          {/* OOO Widget */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 border-t-[3px] border-t-brand-blue">
              <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">
                Out of Office
              </h3>
              <p className="text-[11px] text-brand-grey mt-0.5">Auto-reply & scheduling</p>
            </div>
            <ErrorBoundary label="Out of Office" compact>
              <OooWidget />
            </ErrorBoundary>
          </div>
        </div>

        {/* Right: Feed Panel */}
        <ErrorBoundary label="Feed">
          <FeedPanel />
        </ErrorBoundary>
      </div>
    </div>
  );
}
