// ProConnect — Admin Timezone Visibility Page
// Control which US states/regions are shown in the Time Zone widget on the dashboard.

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  Loader2,
  Save,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSounds } from "@/components/shared/SoundProvider";
import { toast } from "sonner";

// ─── All states (must stay in sync with TimeZoneWidget.tsx) ─────────────────

const STATES = [
  { name: "Alabama",                      zone: "America/Chicago"     },
  { name: "Alaska (Aleutian Is.)",         zone: "America/Adak"        },
  { name: "Alaska",                        zone: "America/Anchorage"   },
  { name: "Arizona (NE)",                  zone: "America/Denver"      },
  { name: "Arizona",                       zone: "America/Phoenix"     },
  { name: "Arkansas",                      zone: "America/Chicago"     },
  { name: "California",                    zone: "America/Los_Angeles" },
  { name: "Colorado",                      zone: "America/Denver"      },
  { name: "Connecticut",                   zone: "America/New_York"    },
  { name: "Delaware",                      zone: "America/New_York"    },
  { name: "District of Columbia",          zone: "America/New_York"    },
  { name: "Florida (NW)",                  zone: "America/Chicago"     },
  { name: "Florida",                       zone: "America/New_York"    },
  { name: "Georgia",                       zone: "America/New_York"    },
  { name: "Hawaii",                        zone: "Pacific/Honolulu"    },
  { name: "Idaho (N)",                     zone: "America/Los_Angeles" },
  { name: "Idaho",                         zone: "America/Denver"      },
  { name: "Illinois",                      zone: "America/Chicago"     },
  { name: "Indiana",                       zone: "America/New_York"    },
  { name: "Indiana (N, NW)",               zone: "America/Chicago"     },
  { name: "Iowa",                          zone: "America/Chicago"     },
  { name: "Kansas",                        zone: "America/Chicago"     },
  { name: "Kentucky (E, S)",               zone: "America/New_York"    },
  { name: "Kentucky (W)",                  zone: "America/Chicago"     },
  { name: "Louisiana",                     zone: "America/Chicago"     },
  { name: "Maine",                         zone: "America/New_York"    },
  { name: "Maryland",                      zone: "America/New_York"    },
  { name: "Massachusetts",                 zone: "America/New_York"    },
  { name: "Michigan (NW)",                 zone: "America/Chicago"     },
  { name: "Michigan",                      zone: "America/New_York"    },
  { name: "Minnesota",                     zone: "America/Chicago"     },
  { name: "Mississippi",                   zone: "America/Chicago"     },
  { name: "Missouri",                      zone: "America/Chicago"     },
  { name: "Montana",                       zone: "America/Denver"      },
  { name: "Nebraska (W)",                  zone: "America/Denver"      },
  { name: "Nebraska",                      zone: "America/Chicago"     },
  { name: "Nevada",                        zone: "America/Los_Angeles" },
  { name: "New Hampshire",                 zone: "America/New_York"    },
  { name: "New Jersey",                    zone: "America/New_York"    },
  { name: "New Mexico",                    zone: "America/Denver"      },
  { name: "New York",                      zone: "America/New_York"    },
  { name: "North Carolina",                zone: "America/New_York"    },
  { name: "North Dakota",                  zone: "America/Chicago"     },
  { name: "North Dakota (SW)",             zone: "America/Denver"      },
  { name: "Ohio",                          zone: "America/New_York"    },
  { name: "Oklahoma",                      zone: "America/Chicago"     },
  { name: "Oregon (E)",                    zone: "America/Denver"      },
  { name: "Oregon",                        zone: "America/Los_Angeles" },
  { name: "Pennsylvania",                  zone: "America/New_York"    },
  { name: "Rhode Island",                  zone: "America/New_York"    },
  { name: "South Carolina",               zone: "America/New_York"    },
  { name: "South Dakota (W)",              zone: "America/Denver"      },
  { name: "South Dakota",                  zone: "America/Chicago"     },
  { name: "Tennessee (E)",                 zone: "America/New_York"    },
  { name: "Tennessee",                     zone: "America/Chicago"     },
  { name: "Texas (W)",                     zone: "America/Denver"      },
  { name: "Texas",                         zone: "America/Chicago"     },
  { name: "Utah",                          zone: "America/Denver"      },
  { name: "Vermont",                       zone: "America/New_York"    },
  { name: "Virginia",                      zone: "America/New_York"    },
  { name: "Washington",                    zone: "America/Los_Angeles" },
  { name: "West Virginia",                 zone: "America/New_York"    },
  { name: "Wisconsin",                     zone: "America/Chicago"     },
  { name: "Wyoming",                       zone: "America/Denver"      },
];

const ZONE_LABELS: Record<string, string> = {
  "America/New_York":    "Eastern",
  "America/Chicago":     "Central",
  "America/Denver":      "Mountain",
  "America/Phoenix":     "Mountain (no DST)",
  "America/Los_Angeles": "Pacific",
  "America/Anchorage":   "Alaska",
  "America/Adak":        "Hawaii-Aleutian",
  "Pacific/Honolulu":    "Hawaii",
};

// USPS abbreviations — only listed for states whose abbreviation is NOT just
// the first two letters of the state name (e.g. Louisiana → LA, Kentucky → KY).
// States like Alabama/AL, California/CA, Colorado/CO already match by name prefix.
const STATE_ABBREVIATIONS: Record<string, string> = {
  "Alaska":        "AK",
  "Arizona":       "AZ",
  "Arkansas":      "AR",
  "Connecticut":   "CT",
  "Georgia":       "GA",
  "Hawaii":        "HI",
  "Kentucky":      "KY",
  "Louisiana":     "LA",
  "Maryland":      "MD",
  "Mississippi":   "MS",
  "Missouri":      "MO",
  "Montana":       "MT",
  "Nebraska":      "NE",
  "Nevada":        "NV",
  "Pennsylvania":  "PA",
  "Tennessee":     "TN",
  "Texas":         "TX",
  "Vermont":       "VT",
  "Virginia":      "VA",
};

// Resolve a row's base state name (strips region suffix like " (NW)") so that
// "Florida (NW)" still matches "FL" or "Florida".
function getBaseStateName(rowName: string): string {
  const parenIdx = rowName.indexOf(" (");
  return parenIdx === -1 ? rowName : rowName.slice(0, parenIdx);
}

// Pre-sort states alphabetically by name
const SORTED_STATES = [...STATES].sort((a, b) => a.name.localeCompare(b.name));

export default function AdminTimezonePage() {
  const { playClick } = useSounds();
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [savedVisibility, setSavedVisibility] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchVisibility = useCallback(async () => {
    try {
      const res = await fetch("/api/timezone-visibility");
      if (res.ok) {
        const data = await res.json() as Record<string, boolean>;
        // Build full map — any state not in data defaults to true (visible)
        const full: Record<string, boolean> = {};
        for (const s of STATES) {
          full[s.name] = data[s.name] !== false;
        }
        setVisibility(full);
        setSavedVisibility(full);
      }
    } catch {
      // default: all visible
      const full: Record<string, boolean> = {};
      for (const s of STATES) full[s.name] = true;
      setVisibility(full);
      setSavedVisibility(full);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisibility();
  }, [fetchVisibility]);

  function toggle(name: string) {
    playClick();
    setVisibility((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function setAll(value: boolean) {
    playClick();
    const full: Record<string, boolean> = {};
    for (const s of STATES) full[s.name] = value;
    setVisibility(full);
  }

  async function handleSave() {
    playClick();
    setIsSaving(true);
    try {
      const res = await fetch("/api/timezone-visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visibility),
      });
      if (!res.ok) throw new Error("Save failed");
      setSavedVisibility({ ...visibility });
      toast.success("Timezone visibility saved");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Search filtering ──────────────────────────────────────────────────────
  // Match strategy: a state row matches if the search query is a prefix of
  //  - the row's name (case-insensitive), e.g. "flo" → Florida, Florida (NW)
  //  - the base state name (case-insensitive), e.g. "louis" → Louisiana
  //  - the state's USPS abbreviation (only for non-prefix abbreviations),
  //    e.g. "LA" → Louisiana, "KY" → Kentucky (E, S) and Kentucky (W)
  const filteredStates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SORTED_STATES;

    return SORTED_STATES.filter((state) => {
      const name = state.name.toLowerCase();
      if (name.startsWith(q)) return true;

      const baseName = getBaseStateName(state.name);
      if (baseName.toLowerCase().startsWith(q)) return true;

      const abbr = STATE_ABBREVIATIONS[baseName];
      if (abbr && abbr.toLowerCase().startsWith(q)) return true;

      return false;
    });
  }, [searchQuery]);

  const hasChanges = JSON.stringify(visibility) !== JSON.stringify(savedVisibility);
  const visibleCount = Object.values(visibility).filter(Boolean).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto px-4 py-8 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            aria-label="Back to admin"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Clock className="w-5 h-5 text-brand-blue" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">US Time Zones Widget</h1>
              <p className="text-sm text-brand-grey">
                Show or hide states in the Time Zone widget on the dashboard.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving || !hasChanges} className="gap-1.5 shrink-0">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>

      {/* Summary bar */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-5 py-3 flex items-center justify-between gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-gray-100">{visibleCount}</span> of{" "}
          <span className="font-semibold">{STATES.length}</span> states visible on the dashboard
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAll(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:underline"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Show All
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button
            type="button"
            onClick={() => setAll(false)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:underline"
          >
            <Square className="w-3.5 h-3.5" />
            Hide All
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by state name or abbreviation (e.g. Louisiana or LA)"
          className="w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm placeholder:text-gray-400 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors"
          aria-label="Search states"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Alphabetical states table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue">
            <div className="w-3.5" aria-hidden />
            <h2 className="text-xs font-bold text-brand-blue tracking-wide uppercase">
              State
            </h2>
            <h2 className="text-xs font-bold text-brand-blue tracking-wide uppercase">
              Time Zone
            </h2>
            <h2 className="text-xs font-bold text-brand-blue tracking-wide uppercase text-right">
              Visible
            </h2>
          </div>

          {/* State rows */}
          {filteredStates.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No states match <span className="font-semibold text-gray-700 dark:text-gray-200">&ldquo;{searchQuery}&rdquo;</span>
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-2 text-xs font-medium text-brand-blue hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredStates.map((state) => {
                const isVisible = visibility[state.name] ?? true;
                return (
                  <label
                    key={state.name}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    {/* Eye icon */}
                    {isVisible ? (
                      <Eye className="w-3.5 h-3.5 text-brand-blue shrink-0" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
                    )}

                    {/* State name */}
                    <span
                      className={`text-sm font-medium ${
                        isVisible
                          ? "text-gray-900 dark:text-gray-100"
                          : "text-gray-400 dark:text-gray-600 line-through"
                      }`}
                    >
                      {state.name}
                    </span>

                    {/* Time zone */}
                    <div className="flex flex-col items-end">
                      <span
                        className={`text-xs font-medium ${
                          isVisible ? "text-gray-600 dark:text-gray-400" : "text-gray-400 dark:text-gray-600"
                        }`}
                      >
                        {ZONE_LABELS[state.zone] ?? state.zone}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                        {state.zone}
                      </span>
                    </div>

                    {/* Toggle */}
                    <div className="relative" onClick={(e) => { e.preventDefault(); toggle(state.name); }}>
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => toggle(state.name)}
                        className="sr-only peer"
                        aria-label={`Toggle ${state.name}`}
                      />
                      <div className="w-10 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-brand-blue transition-colors" />
                      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-5" />
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sticky save footer (shown when unsaved changes exist) */}
      {hasChanges && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <Button onClick={handleSave} disabled={isSaving} size="lg" className="shadow-lg gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}