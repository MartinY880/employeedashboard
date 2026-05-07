// ProConnect — Time Zone Widget
// Sits in a narrow, tall column (col 4, row-span-2) on the dashboard.
// Shows all 50 states + DC in a paginated two-column list that fills the available height.
// State visibility is controlled from /admin/timezone.

"use client";

import { useState, useEffect } from "react";
import { Clock, Search, X, ChevronLeft, ChevronRight } from "lucide-react";

interface StateEntry {
  name: string;
  zone: string;
}

const STATES: StateEntry[] = [
  { name: "Alabama",                         zone: "America/Chicago"     },
  { name: "Alaska (Aleutian Is.)",            zone: "America/Adak"        },
  { name: "Alaska",                           zone: "America/Anchorage"   },
  { name: "Arizona (NE)",                    zone: "America/Denver"      },
  { name: "Arizona",                          zone: "America/Phoenix"     },
  { name: "Arkansas",                         zone: "America/Chicago"     },
  { name: "California",                       zone: "America/Los_Angeles" },
  { name: "Colorado",                         zone: "America/Denver"      },
  { name: "Connecticut",                      zone: "America/New_York"    },
  { name: "Delaware",                         zone: "America/New_York"    },
  { name: "District of Columbia",             zone: "America/New_York"    },
  { name: "Florida (NW)",                    zone: "America/Chicago"     },
  { name: "Florida",                          zone: "America/New_York"    },
  { name: "Georgia",                          zone: "America/New_York"    },
  { name: "Hawaii",                           zone: "Pacific/Honolulu"    },
  { name: "Idaho (N)",                       zone: "America/Los_Angeles" },
  { name: "Idaho",                            zone: "America/Denver"      },
  { name: "Illinois",                         zone: "America/Chicago"     },
  { name: "Indiana",                          zone: "America/New_York"    },
  { name: "Indiana (N, NW)",                 zone: "America/Chicago"     },
  { name: "Iowa",                             zone: "America/Chicago"     },
  { name: "Kansas",                           zone: "America/Chicago"     },
  { name: "Kentucky (E, S)",                 zone: "America/New_York"    },
  { name: "Kentucky (W)",                    zone: "America/Chicago"     },
  { name: "Louisiana",                        zone: "America/Chicago"     },
  { name: "Maine",                            zone: "America/New_York"    },
  { name: "Maryland",                         zone: "America/New_York"    },
  { name: "Massachusetts",                    zone: "America/New_York"    },
  { name: "Michigan (NW)",                   zone: "America/Chicago"     },
  { name: "Michigan",                         zone: "America/New_York"    },
  { name: "Minnesota",                        zone: "America/Chicago"     },
  { name: "Mississippi",                      zone: "America/Chicago"     },
  { name: "Missouri",                         zone: "America/Chicago"     },
  { name: "Montana",                          zone: "America/Denver"      },
  { name: "Nebraska (W)",                    zone: "America/Denver"      },
  { name: "Nebraska",                         zone: "America/Chicago"     },
  { name: "Nevada",                           zone: "America/Los_Angeles" },
  { name: "New Hampshire",                    zone: "America/New_York"    },
  { name: "New Jersey",                       zone: "America/New_York"    },
  { name: "New Mexico",                       zone: "America/Denver"      },
  { name: "New York",                         zone: "America/New_York"    },
  { name: "North Carolina",                   zone: "America/New_York"    },
  { name: "North Dakota",                     zone: "America/Chicago"     },
  { name: "North Dakota (SW)",               zone: "America/Denver"      },
  { name: "Ohio",                             zone: "America/New_York"    },
  { name: "Oklahoma",                         zone: "America/Chicago"     },
  { name: "Oregon (E)",                      zone: "America/Denver"      },
  { name: "Oregon",                           zone: "America/Los_Angeles" },
  { name: "Pennsylvania",                     zone: "America/New_York"    },
  { name: "Rhode Island",                     zone: "America/New_York"    },
  { name: "South Carolina",                   zone: "America/New_York"    },
  { name: "South Dakota (W)",                zone: "America/Denver"      },
  { name: "South Dakota",                     zone: "America/Chicago"     },
  { name: "Tennessee (E)",                   zone: "America/New_York"    },
  { name: "Tennessee",                        zone: "America/Chicago"     },
  { name: "Texas (W)",                       zone: "America/Denver"      },
  { name: "Texas",                            zone: "America/Chicago"     },
  { name: "Utah",                             zone: "America/Denver"      },
  { name: "Vermont",                          zone: "America/New_York"    },
  { name: "Virginia",                         zone: "America/New_York"    },
  { name: "Washington",                       zone: "America/Los_Angeles" },
  { name: "West Virginia",                    zone: "America/New_York"    },
  { name: "Wisconsin",                        zone: "America/Chicago"     },
  { name: "Wyoming",                          zone: "America/Denver"      },
];

const STATE_ABBREVIATIONS: Record<string, string> = {
  "Alabama": "AL",
  "Alaska": "AK",
  "Arizona": "AZ",
  "Arkansas": "AR",
  "California": "CA",
  "Colorado": "CO",
  "Connecticut": "CT",
  "Delaware": "DE",
  "District of Columbia": "DC",
  "Florida": "FL",
  "Georgia": "GA",
  "Hawaii": "HI",
  "Idaho": "ID",
  "Illinois": "IL",
  "Indiana": "IN",
  "Iowa": "IA",
  "Kansas": "KS",
  "Kentucky": "KY",
  "Louisiana": "LA",
  "Maine": "ME",
  "Maryland": "MD",
  "Massachusetts": "MA",
  "Michigan": "MI",
  "Minnesota": "MN",
  "Mississippi": "MS",
  "Missouri": "MO",
  "Montana": "MT",
  "Nebraska": "NE",
  "Nevada": "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  "Ohio": "OH",
  "Oklahoma": "OK",
  "Oregon": "OR",
  "Pennsylvania": "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  "Tennessee": "TN",
  "Texas": "TX",
  "Utah": "UT",
  "Vermont": "VT",
  "Virginia": "VA",
  "Washington": "WA",
  "West Virginia": "WV",
  "Wisconsin": "WI",
  "Wyoming": "WY",
};

const ITEMS_PER_PAGE = 22; // 2 columns × 7 rows — fills vertical space better

function formatTime(date: Date, zone: string): string {
  return date.toLocaleTimeString("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function TimeZoneWidget() {
  const [now, setNow] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hiddenStates, setHiddenStates] = useState<Set<string>>(new Set());

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch("/api/timezone-visibility")
      .then((r) => r.ok ? r.json() : {})
      .then((data: Record<string, boolean>) => {
        const hidden = new Set<string>();
        for (const [name, visible] of Object.entries(data)) {
          if (!visible) hidden.add(name);
        }
        setHiddenStates(hidden);
      })
      .catch(() => { /* keep all states visible */ });
  }, []);

  const visibleStates = hiddenStates.size > 0
    ? STATES.filter((s) => !hiddenStates.has(s.name))
    : STATES;

  const filtered = query.trim()
    ? visibleStates.filter((s) => {
        const q = query.trim().toLowerCase();
        const baseName = s.name.split(" (")[0];
        const baseLower = baseName.toLowerCase();
        const abbr = STATE_ABBREVIATIONS[baseName]?.toLowerCase() ?? "";

        if (q.length <= 2) {
          return abbr === q || abbr.startsWith(q) || baseLower.startsWith(q);
        }
        return baseLower.startsWith(q);
      })
    : visibleStates;

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const half = Math.ceil(pageItems.length / 2);
  const col1 = pageItems.slice(0, half);
  const col2 = pageItems.slice(half);

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(0);
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-3.5 py-2 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="w-3.5 h-3.5 text-brand-blue shrink-0" />
          <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase leading-none">Licensed States</h3>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((safePage - 1 + totalPages) % totalPages)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-brand-blue transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage((safePage + 1) % totalPages)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-brand-blue transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by state…"
            className="w-full pl-8 pr-8 py-1.5 text-[11.5px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-blue/50"
          />
          {query && (
            <button
              type="button"
              onClick={() => handleQueryChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* States list */}
     <div className="flex-1 min-h-0 overflow-hidden px-3 py-1">
        {filtered.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-6">No states match &ldquo;{query}&rdquo;</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4">
            {Array.from({ length: half }, (_, i) => {
              const left = col1[i];
              const right = col2[i];
              return (
                <div key={i} className="col-span-2 grid grid-cols-2 gap-x-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                  {left && (
                    <div className="flex items-center justify-between gap-2 py-[5px]">
                      <span className="text-[11px] text-gray-700 dark:text-gray-300 leading-tight break-words min-w-0">
                        {left.name}
                      </span>
                      <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">
                        {now ? formatTime(now, left.zone) : "--:-- --"}
                      </span>
                    </div>
                  )}
                  {right ? (
                    <div className="flex items-center justify-between gap-2 py-[7px]">
                      <span className="text-[11px] text-gray-700 dark:text-gray-300 leading-tight break-words min-w-0">
                        {right.name}
                      </span>
                      <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">
                        {now ? formatTime(now, right.zone) : "--:-- --"}
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}