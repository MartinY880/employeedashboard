// ProConnect — LenderAccountExecutivesDropdown Widget
// Button that opens a searchable lightbox of AE contacts

"use client";

import { useState } from "react";
import { Building2, Search, Users, X } from "lucide-react";
import { LenderAccountExecutivesFeed } from "./LenderAccountExecutivesFeed";
import { useSounds } from "@/components/shared/SoundProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function LenderAccountExecutivesDropdown() {
  const { playClick } = useSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  function handleOpen() {
    playClick();
    setIsOpen(true);
    setSearch("");
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center px-3 py-2 gap-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <Building2 className="w-4 h-4 text-brand-grey/60 shrink-0" />
        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium flex-1 text-left">AE Contacts</span>
        <Users className="w-3.5 h-3.5 text-brand-grey/50" />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-brand-blue">
              <Users className="w-5 h-5" />
              Account Executive Contacts
            </DialogTitle>
          </DialogHeader>

          {/* Search bar */}
          <div className="px-5 pb-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, lender, email, or phone..."
                className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue/50"
                autoFocus
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable feed */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 scrollbar-thin">
            <LenderAccountExecutivesFeed search={search} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
