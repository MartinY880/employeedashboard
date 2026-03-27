// ProConnect — MentionInput
// Drop-in controlled input with @mention autocomplete.
// Stores mentions as @[Display Name](userId) in the real value,
// displays clean @Display Name text to the user.

"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface MentionUser {
  id: string;
  displayName: string;
  email: string;
  jobTitle: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
  multiline?: boolean;
  rows?: number;
}

export interface MentionInputHandle {
  focus: () => void;
}

interface Chip {
  start: number;
  end: number;
  userId: string;
  displayName: string;
}

// ── Pure helpers ─────────────────────────────────────────────

function displayLength(val: string): number {
  return val.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1").length;
}

function toDisplayText(realValue: string): string {
  return realValue.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1");
}

function deriveChips(realValue: string): Chip[] {
  const chips: Chip[] = [];
  const re = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  let offset = 0;
  while ((m = re.exec(realValue)) !== null) {
    const dLen = m[1].length + 1; // +1 for the @
    const dStart = m.index - offset;
    chips.push({
      start: dStart,
      end: dStart + dLen,
      userId: m[2],
      displayName: m[1],
    });
    offset += m[0].length - dLen;
  }
  return chips;
}

function buildRealValue(display: string, chips: Chip[]): string {
  const sorted = [...chips].sort((a, b) => a.start - b.start);
  let out = "";
  let pos = 0;
  for (const c of sorted) {
    out += display.slice(pos, c.start);
    out += `@[${c.displayName}](${c.userId})`;
    pos = c.end;
  }
  out += display.slice(pos);
  return out;
}

function adjustChips(
  oldDisplay: string,
  newDisplay: string,
  chips: Chip[],
): Chip[] {
  let pre = 0;
  const min = Math.min(oldDisplay.length, newDisplay.length);
  while (pre < min && oldDisplay[pre] === newDisplay[pre]) pre++;
  let oldSuf = oldDisplay.length;
  let newSuf = newDisplay.length;
  while (
    oldSuf > pre &&
    newSuf > pre &&
    oldDisplay[oldSuf - 1] === newDisplay[newSuf - 1]
  ) {
    oldSuf--;
    newSuf--;
  }
  const delStart = pre;
  const delEnd = oldSuf;
  const shift = newDisplay.length - oldDisplay.length;

  return chips
    .filter((c) => c.end <= delStart || c.start >= delEnd)
    .map((c) =>
      c.start >= delEnd
        ? { ...c, start: c.start + shift, end: c.end + shift }
        : c,
    );
}

// ── Component ────────────────────────────────────────────────

export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
  function MentionInput(
    { value, onChange, placeholder, maxLength, disabled, className, multiline = false, rows },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const cacheRef = useRef<Map<string, MentionUser[]>>(new Map());
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingCaretPosRef = useRef<number | null>(null);

    // Suppresses only the reconciliation change for the exact display value
    // we just wrote after inserting a mention, without swallowing the next
    // real keystroke if React never emits that reconciliation event.
    const ignoredChangeValueRef = useRef<string | null>(null);

    const displayText = useMemo(() => toDisplayText(value), [value]);
    const chips = useMemo(() => deriveChips(value), [value]);

    const restoreCaret = useCallback((pos: number) => {
      const el = inputRef.current;
      if (!el) return;

      el.focus();
      el.setSelectionRange(pos, pos);

      // Browsers do not always auto-scroll controlled inputs/textareas
      // after programmatic mention insertion, especially when the caret
      // lands at the end of the field.
      if (pos >= el.value.length - 1) {
        el.scrollLeft = el.scrollWidth;
        if (el instanceof HTMLTextAreaElement) {
          el.scrollTop = el.scrollHeight;
        }
      }
    }, []);

    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionStart, setMentionStart] = useState(0);
    const [results, setResults] = useState<MentionUser[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [dropdownPos, setDropdownPos] = useState<{
      top: number;
      left: number;
      width: number;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    // ── Detect @mention ─────────────────────────────────────
    // Walks backwards from cursor to find the nearest un-chipped @
    // preceded by whitespace (or at position 0). If the text between
    // that @ and the cursor is ≥ 3 characters with no embedded @ or
    // newline, opens the search dropdown.
    const detectMention = useCallback(
      (text: string, cursorPos: number, currentChips: Chip[]) => {
        const before = text.slice(0, cursorPos);
        let atIdx = cursorPos;

        while (atIdx > 0) {
          atIdx = before.lastIndexOf("@", atIdx - 1);
          if (atIdx === -1) break;

          // Skip @ signs that start a completed chip
          if (currentChips.some((c) => c.start === atIdx)) continue;
          // @ must be at start of text or preceded by whitespace
          if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) continue;

          const query = before.slice(atIdx + 1);
          // Reject if another @ or newline appears inside the query
          if (/[@\n]/.test(query)) continue;

          if (query.length >= 3) {
            setMentionQuery(query);
            setMentionStart(atIdx);
            setShowDropdown(true);
            return;
          }
          // Found a valid @ but query is too short — stop searching
          setMentionQuery(null);
          setShowDropdown(false);
          return;
        }

        setMentionQuery(null);
        setShowDropdown(false);
      },
      [],
    );

    // ── Fetch results (debounced + abortable) ───────────────
    const fetchResults = useCallback(async (query: string, offset = 0) => {
      const cacheKey = `${query.toLowerCase()}:${offset}`;
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        if (offset === 0) {
          setResults(cached);
          setSelectedIndex(0);
        } else {
          setResults((prev) => [...prev, ...cached]);
        }
        setLoading(false);
        return;
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await fetch(
          `/api/directory/mention-search?q=${encodeURIComponent(query)}&offset=${offset}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error("fetch");
        const data = await res.json();
        const users: MentionUser[] = data.users || [];
        const more: boolean = data.hasMore ?? false;
        cacheRef.current.set(cacheKey, users);
        if (!ctrl.signal.aborted) {
          if (offset === 0) {
            setResults(users);
            setSelectedIndex(0);
          } else {
            setResults((prev) => [...prev, ...users]);
          }
          setHasMore(more);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (offset === 0) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }, []);

    // Load more results for the current query
    const loadMore = useCallback(() => {
      if (!mentionQuery || loadingMore || !hasMore) return;
      fetchResults(mentionQuery, results.length);
    }, [mentionQuery, loadingMore, hasMore, results.length, fetchResults]);

    useEffect(() => {
      if (!mentionQuery || mentionQuery.length < 3) {
        setResults([]);
        setHasMore(false);
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchResults(mentionQuery), 300);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, [mentionQuery, fetchResults]);

    // ── Select mention ──────────────────────────────────────
    const selectMention = useCallback(
      (user: MentionUser) => {
        const cursorPos =
          inputRef.current?.selectionStart ?? displayText.length;
        const before = displayText.slice(0, mentionStart);
        const after = displayText.slice(cursorPos);
        const tag = `@${user.displayName}`;
        const newDisplay = before + tag + " " + after;

        const newChip: Chip = {
          start: mentionStart,
          end: mentionStart + tag.length,
          userId: user.id,
          displayName: user.displayName,
        };

        const replaced = cursorPos - mentionStart;
        const inserted = tag.length + 1; // +1 for trailing space
        const shift = inserted - replaced;
        const kept = chips
          .filter((c) => c.end <= mentionStart || c.start >= cursorPos)
          .map((c) =>
            c.start >= cursorPos
              ? { ...c, start: c.start + shift, end: c.end + shift }
              : c,
          );
        const all = [...kept, newChip].sort((a, b) => a.start - b.start);
        const newReal = buildRealValue(newDisplay, all);

        ignoredChangeValueRef.current = newDisplay;

        onChange(newReal);
        setShowDropdown(false);
        setMentionQuery(null);
        setResults([]);
        setHasMore(false);

        pendingCaretPosRef.current = mentionStart + tag.length + 1;
      },
      [displayText, mentionStart, chips, onChange],
    );

    // ── onChange handler ─────────────────────────────────────
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (ignoredChangeValueRef.current === e.target.value) {
          ignoredChangeValueRef.current = null;
          return;
        }
        ignoredChangeValueRef.current = null;

        const newDisplay = e.target.value;
        const newChips = adjustChips(displayText, newDisplay, chips);
        const newReal = buildRealValue(newDisplay, newChips);

        if (newReal === value) return;
        if (maxLength && displayLength(newReal) > maxLength) return;

        onChange(newReal);

        const cursor = e.target.selectionStart ?? newDisplay.length;
        detectMention(newDisplay, cursor, newChips);
      },
      [displayText, chips, value, maxLength, onChange, detectMention],
    );

    // ── Selection / cursor change ───────────────────────────
    // Derives display text and chips directly from the value prop
    // instead of using the memos, which may be one render stale
    // when this fires right after selectMention updates the value.
    const handleSelect = useCallback(() => {
      const cursor = inputRef.current?.selectionStart ?? 0;
      const latestDisplay = toDisplayText(value);
      const latestChips = deriveChips(value);
      detectMention(latestDisplay, cursor, latestChips);
    }, [value, detectMention]);

    // ── Keyboard navigation ─────────────────────────────────
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!showDropdown || results.length === 0) return;

        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            setSelectedIndex((p) => {
              const n = p < results.length - 1 ? p + 1 : 0;
              // When arrowing past the last item, load more if available
              if (p === results.length - 1 && hasMore) loadMore();
              scrollIntoView(dropdownRef.current, n);
              return n;
            });
            return;
          case "ArrowUp":
            e.preventDefault();
            setSelectedIndex((p) => {
              const n = p > 0 ? p - 1 : results.length - 1;
              scrollIntoView(dropdownRef.current, n);
              return n;
            });
            return;
          case "Tab":
          case "Enter":
            e.preventDefault();
            e.stopPropagation();
            selectMention(results[selectedIndex]);
            return;
          case "Escape":
            e.preventDefault();
            setShowDropdown(false);
            setMentionQuery(null);
            return;
        }
      },
      [showDropdown, results, selectedIndex, selectMention, hasMore, loadMore],
    );

    // ── Close on outside click ──────────────────────────────
    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (
          wrapperRef.current &&
          !wrapperRef.current.contains(e.target as Node) &&
          dropdownRef.current &&
          !dropdownRef.current.contains(e.target as Node)
        ) {
          setShowDropdown(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, []);

    // ── Dropdown positioning ────────────────────────────────
    useLayoutEffect(() => {
      if (!showDropdown || !inputRef.current) {
        setDropdownPos(null);
        return;
      }
      const rect = inputRef.current.getBoundingClientRect();
      const count = results.length || 1;
      const h = Math.min(count * 36 + 4, 192);
      setDropdownPos({ top: rect.top - h, left: rect.left, width: rect.width });
    }, [showDropdown, results, loading, mentionQuery]);

    useLayoutEffect(() => {
      const pos = pendingCaretPosRef.current;
      if (pos === null) return;

      pendingCaretPosRef.current = null;
      restoreCaret(pos);

      requestAnimationFrame(() => {
        restoreCaret(pos);
      });
    }, [displayText, restoreCaret]);

    return (
      <div ref={wrapperRef} className="relative flex-1">
        {multiline ? (
          <Textarea
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            placeholder={placeholder}
            value={displayText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            disabled={disabled}
            className={className}
            autoComplete="off"
            rows={rows}
          />
        ) : (
          <Input
            ref={inputRef as React.Ref<HTMLInputElement>}
            placeholder={placeholder}
            value={displayText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            disabled={disabled}
            className={className}
            autoComplete="off"
          />
        )}

        {showDropdown &&
          dropdownPos &&
          createPortal(
            <AnimatePresence>
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "fixed",
                  top: dropdownPos.top,
                  left: dropdownPos.left,
                  width: dropdownPos.width,
                }}
                className="z-[9999] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-t-lg border-b-0 shadow-lg overflow-hidden max-h-48 overflow-y-auto"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  if (
                    hasMore &&
                    !loadingMore &&
                    el.scrollTop + el.clientHeight >= el.scrollHeight - 8
                  ) {
                    loadMore();
                  }
                }}
              >
                {loading && results.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Searching…
                  </div>
                ) : results.length === 0 && mentionQuery ? (
                  <div className="px-3 py-2 text-xs text-gray-400">
                    No people found
                  </div>
                ) : (
                  <>
                  {results.map((user, i) => (
                    <button
                      key={user.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectMention(user);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                        i === selectedIndex
                          ? "bg-brand-blue/10 dark:bg-brand-blue/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                      role="option"
                      aria-selected={i === selectedIndex}
                    >
                      <div className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-brand-blue/70 to-brand-blue flex items-center justify-center text-white text-[10px] font-bold">
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                          {user.displayName}
                        </div>
                        {user.jobTitle && (
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                            {user.jobTitle}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                  {loadingMore && (
                    <div className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-gray-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                    </div>
                  )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>,
            document.body,
          )}
      </div>
    );
  },
);

function scrollIntoView(el: HTMLDivElement | null, idx: number) {
  if (!el) return;
  requestAnimationFrame(() => {
    el.querySelectorAll<HTMLElement>('[role="option"]')[idx]?.scrollIntoView({
      block: "nearest",
    });
  });
}
