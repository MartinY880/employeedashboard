// ProConnect — DirectorySearchBar Widget
// Thin search bar that spans above OOO + half of Be Brilliant
// Clicking a result opens a lightbox with person details

"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDirectory, type DirectoryNode } from "@/hooks/useDirectory";
import { useSounds } from "@/components/shared/SoundProvider";
import { PersonLightbox, getInitials } from "@/components/shared/ProfileDialog";
import Link from "next/link";

function flattenTree(nodes: DirectoryNode[]): DirectoryNode[] {
  const flat: DirectoryNode[] = [];
  for (const n of nodes) {
    flat.push(n);
    if (n.directReports?.length) flat.push(...flattenTree(n.directReports));
  }
  return flat;
}

export function DirectorySearchBar() {
  const { users, isLoading } = useDirectory("tree");
  const { playClick, playPop } = useSounds();
  const [query, setQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<DirectoryNode | null>(null);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const flatUsers = useMemo(() => flattenTree(users), [users]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return flatUsers
      .filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          (u.jobTitle && u.jobTitle.toLowerCase().includes(q)) ||
          (u.mail && u.mail.toLowerCase().includes(q)) ||
          (u.department && u.department.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [flatUsers, query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPerson = (person: DirectoryNode) => {
    playPop();
    setSelectedPerson(person);
    setShowResults(false);
    setQuery("");
  };

  return (
    <>
      {/* Search bar */}
      <div ref={containerRef} className="relative">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center px-3 py-2 gap-2">
          <Search className="w-4 h-4 text-brand-grey/50 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder={isLoading ? "Loading directory…" : "Search directory — find a colleague…"}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => { if (query.trim()) setShowResults(true); }}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-brand-grey/50 dark:text-gray-200"
            disabled={isLoading}
          />
          {query && (
            <button onClick={() => { setQuery(""); playClick(); }}>
              <X className="w-3.5 h-3.5 text-brand-grey hover:text-gray-700" />
            </button>
          )}
          <Link
            href="/directory"
            className="text-[10px] text-brand-blue hover:underline font-medium shrink-0"
          >
            Full Directory →
          </Link>
        </div>

        {/* Dropdown results */}
        <AnimatePresence>
          {showResults && query.trim() && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-50 overflow-hidden"
            >
              {results.length === 0 ? (
                <div className="px-4 py-5 text-center text-xs text-brand-grey">
                  No results for &ldquo;{query}&rdquo;
                </div>
              ) : (
                <div className="py-1 max-h-[280px] overflow-y-auto">
                  {results.map((person, i) => (
                    <motion.button
                      key={person.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => handleSelectPerson(person)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-brand-blue/5 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage
                          src={`/api/directory/photo?userId=${encodeURIComponent(person.id)}&name=${encodeURIComponent(person.displayName)}&size=48x48`}
                          alt={person.displayName}
                        />
                        <AvatarFallback className="bg-brand-blue/10 text-brand-blue text-[10px] font-bold">
                          {getInitials(person.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">
                          {person.displayName}
                        </div>
                        <div className="text-[11px] text-brand-grey truncate">
                          {person.jobTitle || "Team Member"}
                          {person.department ? ` · ${person.department}` : ""}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <PersonLightbox
        user={selectedPerson}
        open={!!selectedPerson}
        onClose={() => setSelectedPerson(null)}
      />
    </>
  );
}
