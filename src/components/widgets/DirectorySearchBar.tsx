// ProConnect — DirectorySearchBar Widget
// Thin search bar that spans above OOO + half of Be Brilliant
// Clicking a result opens a lightbox with person details

"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Mail, MapPin, Building2, Phone, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDirectory, type DirectoryNode } from "@/hooks/useDirectory";
import { useSounds } from "@/components/shared/SoundProvider";
import Link from "next/link";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex items-center px-3 py-2 gap-2">
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
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-brand-grey/50"
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
              className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden"
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
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-brand-blue/5 transition-colors text-left"
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
                        <div className="font-semibold text-sm text-gray-800 truncate">
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

      {/* Person Detail Lightbox */}
      <AnimatePresence>
        {selectedPerson && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setSelectedPerson(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header band */}
              <div className="bg-brand-blue px-6 pt-6 pb-10 relative">
                <button
                  onClick={() => setSelectedPerson(null)}
                  className="absolute top-3 right-3 text-white/70 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Avatar overlap */}
              <div className="relative -mt-8 flex justify-center">
                <Avatar className="h-16 w-16 ring-4 ring-white shadow-lg">
                  <AvatarImage
                    src={`/api/directory/photo?userId=${encodeURIComponent(selectedPerson.id)}&name=${encodeURIComponent(selectedPerson.displayName)}&size=120x120`}
                    alt={selectedPerson.displayName}
                  />
                  <AvatarFallback className="bg-brand-blue text-white text-lg font-bold">
                    {getInitials(selectedPerson.displayName)}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Info */}
              <div className="px-6 pt-3 pb-6 text-center">
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedPerson.displayName}
                </h2>
                <p className="text-sm text-brand-grey mt-0.5">
                  {selectedPerson.jobTitle || "Team Member"}
                </p>

                <div className="mt-5 space-y-3 text-left">
                  {selectedPerson.mail && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-brand-blue shrink-0" />
                      <a
                        href={`mailto:${selectedPerson.mail}`}
                        className="text-brand-blue hover:underline truncate"
                      >
                        {selectedPerson.mail}
                      </a>
                    </div>
                  )}
                  {selectedPerson.department && (
                    <div className="flex items-center gap-3 text-sm">
                      <Building2 className="w-4 h-4 text-brand-grey shrink-0" />
                      <span className="text-gray-700">{selectedPerson.department}</span>
                    </div>
                  )}
                  {selectedPerson.officeLocation && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-brand-grey shrink-0" />
                      <span className="text-gray-700">{selectedPerson.officeLocation}</span>
                    </div>
                  )}
                  {selectedPerson.userPrincipalName && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-brand-grey shrink-0" />
                      <span className="text-gray-700 truncate">
                        {selectedPerson.userPrincipalName}
                      </span>
                    </div>
                  )}
                  {selectedPerson.directReports && selectedPerson.directReports.length > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <Users className="w-4 h-4 text-brand-grey shrink-0" />
                      <span className="text-gray-700">
                        {selectedPerson.directReports.length} direct report{selectedPerson.directReports.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedPerson(null)}
                  className="mt-6 w-full py-2.5 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-brand-blue/90 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
