// ProConnect — Reusable Icon Picker Dropdown
// Uses the same icon database as QuickLinksBar (lucide, react-icons, font-awesome)

"use client";

import { useState, useMemo, useDeferredValue, useCallback, useRef, useEffect } from "react";
import { ChevronDown, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AVAILABLE_ICON_OPTIONS,
  normalizeQuickLinkIconId,
  renderQuickLinkIconPreview,
} from "@/components/widgets/QuickLinksBar";

const ICON_INITIAL_RESULTS = 40;
const ICON_LOAD_STEP = 60;
const ICON_MAX_RESULTS = 120;
const ICON_MIN_QUERY_LENGTH = 2;

interface IconPickerDropdownProps {
  value: string;              // icon id e.g. "lucide:building" or ""
  onChange: (iconId: string) => void;
  placeholder?: string;
  className?: string;
  buttonSize?: "sm" | "default";
  showClear?: boolean;
}

export function IconPickerDropdown({
  value,
  onChange,
  placeholder = "Select icon",
  className = "",
  buttonSize = "default",
  showClear = true,
}: IconPickerDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(ICON_INITIAL_RESULTS);
  const deferredSearch = useDeferredValue(search);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [open]);

  const filteredOptions = useMemo(() => {
    if (!open) return [];
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return AVAILABLE_ICON_OPTIONS.slice(0, visibleCount);
    if (q.length < ICON_MIN_QUERY_LENGTH) return [];
    return AVAILABLE_ICON_OPTIONS.filter((opt) =>
      [opt.label, opt.id, ...opt.keywords].join(" ").toLowerCase().includes(q)
    ).slice(0, ICON_MAX_RESULTS);
  }, [deferredSearch, open, visibleCount]);

  const hasMore = useMemo(() => {
    return !deferredSearch.trim() && visibleCount < AVAILABLE_ICON_OPTIONS.length;
  }, [deferredSearch, visibleCount]);

  const grouped = useMemo(() => ({
    lucide: filteredOptions.filter((o) => o.library === "lucide"),
    reactIcons: filteredOptions.filter((o) => o.library === "react-icons"),
    fontAwesome: filteredOptions.filter((o) => o.library === "fontawesome"),
  }), [filteredOptions]);

  const selectedOption = useMemo(() => {
    if (!value) return null;
    const normalized = normalizeQuickLinkIconId(value);
    return AVAILABLE_ICON_OPTIONS.find((o) => o.id === normalized) ?? null;
  }, [value]);

  const selectIcon = useCallback((iconId: string) => {
    onChange(iconId);
    setOpen(false);
    setSearch("");
  }, [onChange]);

  const sizeClasses = buttonSize === "sm" ? "h-7 text-xs px-2" : "h-9 text-sm";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Button
        type="button"
        variant="outline"
        className={`w-full justify-between ${sizeClasses}`}
        onClick={() => {
          setOpen((prev) => {
            if (!prev) setVisibleCount(ICON_INITIAL_RESULTS);
            else setSearch("");
            return !prev;
          });
        }}
      >
        {selectedOption ? (
          <span className="inline-flex items-center gap-2 truncate">
            {renderQuickLinkIconPreview(selectedOption.id, "w-4 h-4")}
            <span className="truncate">{selectedOption.label}</span>
          </span>
        ) : (
          <span className="text-gray-400 inline-flex items-center gap-1.5">
            <Smile className="w-3.5 h-3.5" />
            {placeholder}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1" />
      </Button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-md border bg-popover text-popover-foreground shadow-md min-w-[240px]">
          <div className="p-1 border-b border-border">
            <Input
              placeholder="Search icons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs"
              autoFocus
            />
          </div>
          <div
            className="max-h-56 overflow-y-auto p-1"
            onScroll={(e) => {
              if (deferredSearch.trim()) return;
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
                setVisibleCount((prev) => Math.min(prev + ICON_LOAD_STEP, AVAILABLE_ICON_OPTIONS.length));
              }
            }}
          >
            {search.trim().length === 1 && (
              <div className="px-2 py-1.5 text-[10px] text-gray-400">
                Type at least 2 characters to search
              </div>
            )}

            {/* Clear option */}
            {showClear && value && !search.trim() && (
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent hover:text-accent-foreground text-red-500"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectIcon("")}
              >
                ✕ Remove icon
              </button>
            )}

            {grouped.lucide.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] text-gray-400 font-medium">Lucide</div>
                {grouped.lucide.map((icon) => (
                  <button
                    key={icon.id}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectIcon(icon.id)}
                  >
                    <span className="inline-flex items-center gap-2">
                      {renderQuickLinkIconPreview(icon.id, "w-3.5 h-3.5")}
                      {icon.label}
                    </span>
                  </button>
                ))}
              </>
            )}

            {grouped.reactIcons.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] text-gray-400 font-medium">React Icons</div>
                {grouped.reactIcons.map((icon) => (
                  <button
                    key={icon.id}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectIcon(icon.id)}
                  >
                    <span className="inline-flex items-center gap-2">
                      {renderQuickLinkIconPreview(icon.id, "w-3.5 h-3.5")}
                      {icon.label}
                    </span>
                  </button>
                ))}
              </>
            )}

            {grouped.fontAwesome.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] text-gray-400 font-medium">Font Awesome</div>
                {grouped.fontAwesome.map((icon) => (
                  <button
                    key={icon.id}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectIcon(icon.id)}
                  >
                    <span className="inline-flex items-center gap-2">
                      {renderQuickLinkIconPreview(icon.id, "w-3.5 h-3.5")}
                      {icon.label}
                    </span>
                  </button>
                ))}
              </>
            )}

            {filteredOptions.length === 0 && search.trim().length !== 1 && (
              <div className="px-2 py-1.5 text-[10px] text-gray-400">No icons found</div>
            )}
            {hasMore && (
              <div className="px-2 py-1.5 text-[10px] text-gray-400">Scroll to load more…</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
