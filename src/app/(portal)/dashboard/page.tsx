// ProConnect — Main Employee Dashboard
// Stats row + search/alerts bar + 3-column layout

import { StatsRow } from "@/components/widgets/StatsRow";
import { QuickLinksBar } from "@/components/widgets/QuickLinksBar";
import { DirectorySearchBar } from "@/components/widgets/DirectorySearchBar";
import { AlertsDropdown } from "@/components/widgets/AlertsDropdown";
import { BeBrilliantWidget } from "@/components/widgets/BeBrilliantWidget";
import { CalendarWidget } from "@/components/widgets/CalendarWidget";
import { OooWidget } from "@/components/widgets/OooWidget";
import { FeedPanel } from "@/components/widgets/FeedPanel";
import { EmployeeHighlight } from "@/components/widgets/EmployeeHighlight";
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

      {/* Quick Links */}
      <section className="mb-4">
        <ErrorBoundary label="Quick Links" compact>
          <QuickLinksBar />
        </ErrorBoundary>
      </section>

      {/* Directory Search + Alerts Bar */}
      <section className="mb-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ErrorBoundary label="Directory Search" compact>
          <DirectorySearchBar />
        </ErrorBoundary>
        <ErrorBoundary label="Alerts" compact>
          <AlertsDropdown />
        </ErrorBoundary>
      </section>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_340px] gap-5 items-start">
        {/* Left: OOO + Upcoming Holidays */}
        <div className="space-y-5">
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

          {/* Upcoming Holidays */}
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
        </div>

        {/* Center: Be Brilliant */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 border-t-[3px] border-t-brand-blue">
              <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase flex items-center gap-1.5">
                Be Brilliant
              </h3>
              <p className="text-[11px] text-brand-grey mt-0.5">Vote on ideas &amp; share yours</p>
            </div>
            <ErrorBoundary label="Be Brilliant" compact>
              <BeBrilliantWidget />
            </ErrorBoundary>
          </div>
        </div>

        {/* Right: Employee Highlight + Props & Trophies */}
        <div className="space-y-4">
          <ErrorBoundary label="Employee Highlight" compact>
            <EmployeeHighlight />
          </ErrorBoundary>
          <ErrorBoundary label="Feed">
            <FeedPanel />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
