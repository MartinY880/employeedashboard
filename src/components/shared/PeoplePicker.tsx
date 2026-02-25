// ProConnect — PeoplePicker
// Autocomplete input that searches the org directory (Graph API) as you type

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, User } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface PersonResult {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle: string | null;
  department: string | null;
}

interface PeoplePickerProps {
  value: string;
  onChange: (email: string, name: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  selectedName?: string;
  /** Email address to exclude from results (e.g. current user) */
  excludeEmail?: string;
}

export function PeoplePicker({
  value,
  onChange,
  onClear,
  placeholder = "Search name or email @mtgpros.com...",
  className = "",
  selectedName,
  excludeEmail,
}: PeoplePickerProps) {
  const [query, setQuery] = useState(selectedName || value || "");
  const [results, setResults] = useState<PersonResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasSelected, setHasSelected] = useState(!!value);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Search directory API with debounce
  const searchPeople = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/directory?search=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      const users: PersonResult[] = (data.users || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (u: any) => ({
          id: u.id,
          displayName: u.displayName,
          mail: u.mail,
          userPrincipalName: u.userPrincipalName,
          jobTitle: u.jobTitle,
          department: u.department,
        })
      ).filter((u: PersonResult) => {
        if (!excludeEmail) return true;
        const email = (u.mail || u.userPrincipalName || "").toLowerCase();
        return email !== excludeEmail.toLowerCase();
      });
      setResults(users);
      setIsOpen(users.length > 0);
      setSelectedIndex(-1);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  const handleInputChange = (val: string) => {
    setQuery(val);
    setHasSelected(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      searchPeople(val);
    }, 250);
  };

  // Select a person
  const handleSelect = (person: PersonResult) => {
    const email = person.mail || person.userPrincipalName;
    setQuery(person.displayName);
    setHasSelected(true);
    setIsOpen(false);
    setResults([]);
    onChange(email, person.displayName);
  };

  // Clear selection
  const handleClear = () => {
    setQuery("");
    setHasSelected(false);
    setResults([]);
    setIsOpen(false);
    onChange("", "");
    onClear?.();
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync external value changes
  useEffect(() => {
    if (selectedName && !hasSelected) {
      setQuery(selectedName);
      setHasSelected(true);
    }
  }, [selectedName, hasSelected]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-brand-grey pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0 && !hasSelected) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="pl-8 pr-8 text-xs h-8"
          autoComplete="off"
        />
        {/* Loading spinner or clear button */}
        {isLoading ? (
          <div className="absolute right-2.5 top-2">
            <div className="w-3.5 h-3.5 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
          </div>
        ) : hasSelected ? (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1.5 p-0.5 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-brand-grey" />
          </button>
        ) : null}
      </div>

      {/* Selected person chip */}
      {hasSelected && value && (
        <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 bg-brand-blue/5 rounded-md border border-brand-blue/15">
          <User className="w-3 h-3 text-brand-blue shrink-0" />
          <span className="text-[11px] text-brand-blue font-medium truncate">
            {query}
          </span>
          <span className="text-[10px] text-brand-grey truncate">
            {value}
          </span>
        </div>
      )}

      {/* Dropdown results */}
      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-9 left-0 right-0 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden max-h-48 overflow-y-auto"
          >
            {results.map((person, i) => (
              <button
                key={person.id}
                onClick={() => handleSelect(person)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  i === selectedIndex
                    ? "bg-brand-blue/5"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue/10 shrink-0">
                  <span className="text-[10px] font-bold text-brand-blue">
                    {person.displayName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-800 truncate">
                    {person.displayName}
                  </div>
                  <div className="text-[10px] text-brand-grey truncate">
                    {person.mail || person.userPrincipalName}
                    {person.jobTitle && ` · ${person.jobTitle}`}
                  </div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
