// ProConnect — BannerTitleEditor
// Rich text editor for the pillar header banner title
// Supports: font family, font size, bold, italic, text color, alignment

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import { FontSize } from "./FontSizeExtension";
import { TextStroke } from "./TextStrokeExtension";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  PenLine,
  RemoveFormatting,
} from "lucide-react";

const STROKE_WIDTHS = ["0.5px", "1px", "1.5px", "2px", "3px", "4px", "5px"];

// ── Font families available in the picker ─────────────────────────
const FONT_OPTIONS = [
  { label: "Default (Geist)", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "Geist Mono", value: "var(--font-geist-mono), monospace" },
  // Google Fonts (loaded dynamically)
  { label: "Montserrat", value: "Montserrat, sans-serif", google: "Montserrat:wght@400;700;900" },
  { label: "Playfair Display", value: "'Playfair Display', serif", google: "Playfair+Display:wght@400;700;900" },
  { label: "Oswald", value: "Oswald, sans-serif", google: "Oswald:wght@400;500;700" },
  { label: "Raleway", value: "Raleway, sans-serif", google: "Raleway:wght@400;700;900" },
  { label: "Poppins", value: "Poppins, sans-serif", google: "Poppins:wght@400;600;700;900" },
  { label: "Roboto", value: "Roboto, sans-serif", google: "Roboto:wght@400;500;700;900" },
  { label: "Lato", value: "Lato, sans-serif", google: "Lato:wght@400;700;900" },
  { label: "Open Sans", value: "'Open Sans', sans-serif", google: "Open+Sans:wght@400;600;700" },
  { label: "Bebas Neue", value: "'Bebas Neue', sans-serif", google: "Bebas+Neue" },
  { label: "Anton", value: "Anton, sans-serif", google: "Anton" },
];

// ── Font size presets ────────────────────────────────────────────
const FONT_SIZE_OPTIONS = [
  "8px", "10px", "11px", "12px", "14px", "16px", "18px", "20px",
  "24px", "28px", "32px", "36px", "42px", "48px", "56px", "64px",
];

const FONT_COLORS = [
  "#FFFFFF", "#000000", "#434343", "#666666", "#999999",
  "#E03131", "#E8590C", "#F08C00", "#2F9E44", "#1971C2", "#6741D9",
  "#FFC9C9", "#FFD8A8", "#FFEC99", "#B2F2BB", "#A5D8FF", "#D0BFFF",
];

// Load a Google Font stylesheet dynamically (only once per font)
const loadedFonts = new Set<string>();
function loadGoogleFont(spec: string) {
  if (loadedFonts.has(spec) || typeof document === "undefined") return;
  loadedFonts.add(spec);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  document.head.appendChild(link);
}

// ── Toolbar button ───────────────────────────────────────────────
function Btn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${
        active ? "bg-gray-200 dark:bg-gray-600 text-brand-blue" : "text-gray-500 dark:text-gray-400"
      }`}
    >
      {children}
    </button>
  );
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function BannerTitleEditor({ value, onChange, placeholder, className = "" }: Props) {
  const customColorRef = useRef<HTMLInputElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const [showStrokePicker, setShowStrokePicker] = useState(false);
  const strokeRef = useRef<HTMLDivElement>(null);
  const strokeCustomColorRef = useRef<HTMLInputElement>(null);

  // Preload any Google Fonts referenced in the initial HTML value
  useEffect(() => {
    for (const opt of FONT_OPTIONS) {
      if (opt.google && opt.value && value.includes(opt.value.replace(/'/g, "&apos;").split(",")[0].replace(/'/g, ""))) {
        loadGoogleFont(opt.google);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    const h = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setShowColorPicker(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showColorPicker]);

  // Close stroke picker on outside click
  useEffect(() => {
    if (!showStrokePicker) return;
    const h = (e: MouseEvent) => {
      if (strokeRef.current && !strokeRef.current.contains(e.target as Node)) setShowStrokePicker(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showStrokePicker]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: false, orderedList: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TextStroke,
    ],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class: "px-3 py-2 min-h-[48px] max-h-[200px] overflow-y-auto focus:outline-none text-sm text-white",
        style: "background: linear-gradient(135deg, #06427f 0%, #084f96 100%); border-radius: 0 0 8px 8px;",
      },
    },
  });

  // Sync external value changes
  const lastExternal = useRef(value);
  useEffect(() => {
    if (!editor) return;
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      const { from, to } = editor.state.selection;
      editor.commands.setContent(value, { emitUpdate: false });
      try {
        const maxPos = editor.state.doc.content.size;
        editor.commands.setTextSelection({ from: Math.min(from, maxPos), to: Math.min(to, maxPos) });
      } catch { /* ignore */ }
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    const h = () => { lastExternal.current = editor.getHTML(); };
    editor.on("update", h);
    return () => { editor.off("update", h); };
  }, [editor]);

  // Get current font family name from selection
  const currentFamily = useMemo(() => {
    if (!editor) return "";
    const ff = editor.getAttributes("textStyle")?.fontFamily as string | undefined;
    return ff || "";
  }, [editor?.state.selection]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentSize = useMemo(() => {
    if (!editor) return "";
    const fs = editor.getAttributes("textStyle")?.fontSize as string | undefined;
    return fs || "";
  }, [editor?.state.selection]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFontChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!editor) return;
    const val = e.target.value;
    if (!val) {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      // Load Google Font if needed
      const opt = FONT_OPTIONS.find((o) => o.value === val);
      if (opt?.google) loadGoogleFont(opt.google);
      editor.chain().focus().setFontFamily(val).run();
    }
  }, [editor]);

  const handleSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!editor) return;
    const val = e.target.value;
    if (!val) {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(val).run();
    }
  }, [editor]);

  if (!editor) return null;

  const ic = "w-3.5 h-3.5";

  return (
    <div className={`relative border border-gray-200 dark:border-gray-700 rounded-lg overflow-visible bg-white dark:bg-gray-900 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-1.5 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {/* Font Family */}
        <select
          value={currentFamily}
          onChange={handleFontChange}
          className="h-7 text-[11px] rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-1 max-w-[130px] cursor-pointer"
          title="Font Family"
        >
          {FONT_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Font Size */}
        <select
          value={currentSize}
          onChange={handleSizeChange}
          className="h-7 text-[11px] rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-1 w-[62px] cursor-pointer"
          title="Font Size"
        >
          <option value="">Auto</option>
          {FONT_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-0.5" />

        <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <Bold className={ic} />
        </Btn>
        <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <Italic className={ic} />
        </Btn>
        <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
          <UnderlineIcon className={ic} />
        </Btn>

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-0.5" />

        <Btn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align Left">
          <AlignLeft className={ic} />
        </Btn>
        <Btn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Align Center">
          <AlignCenter className={ic} />
        </Btn>
        <Btn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align Right">
          <AlignRight className={ic} />
        </Btn>

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-0.5" />

        {/* Font Color */}
        <div className="relative" ref={colorRef}>
          <Btn onClick={() => setShowColorPicker((p) => !p)} title="Font Color">
            <div className="flex flex-col items-center gap-0">
              <Type className={ic} />
              <div
                className="w-3 h-0.5 rounded-full"
                style={{ backgroundColor: (editor.getAttributes("textStyle")?.color as string) || "#ffffff" }}
              />
            </div>
          </Btn>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 w-[175px]">
              <div className="grid grid-cols-6 gap-1 mb-2">
                {FONT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => { editor.chain().focus().setColor(color).run(); setShowColorPicker(false); }}
                    title={color}
                    className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 transition-transform hover:scale-110"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }}
                  className="flex-1 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                  Reset
                </button>
                <button type="button" onClick={() => customColorRef.current?.click()}
                  className="flex-1 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                  Custom…
                </button>
              </div>
              <input ref={customColorRef} type="color" className="sr-only" onChange={(e) => { editor.chain().focus().setColor(e.target.value).run(); setShowColorPicker(false); }} />
            </div>
          )}
        </div>

        {/* Text Stroke */}
        <div className="relative" ref={strokeRef}>
          <Btn onClick={() => setShowStrokePicker((p) => !p)} title="Text Stroke">
            <div className="flex flex-col items-center gap-0">
              <PenLine className={ic} />
              <div
                className="w-3 h-0.5 rounded-full"
                style={{ backgroundColor: (editor.getAttributes("textStyle")?.textStrokeColor as string) || "transparent" }}
              />
            </div>
          </Btn>
          {showStrokePicker && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2.5 w-[200px]">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Stroke Color</p>
              <div className="grid grid-cols-6 gap-1 mb-2">
                {FONT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      const w = (editor.getAttributes("textStyle")?.textStrokeWidth as string) || "1px";
                      editor.chain().focus().setTextStroke({ color, width: w }).run();
                    }}
                    title={color}
                    className={`w-6 h-6 rounded border transition-transform hover:scale-110 ${
                      (editor.getAttributes("textStyle")?.textStrokeColor as string)?.toLowerCase() === color.toLowerCase()
                        ? "ring-2 ring-blue-500 ring-offset-1" : "border-gray-300 dark:border-gray-600"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <button type="button" onClick={() => strokeCustomColorRef.current?.click()}
                className="w-full text-xs px-2 py-1 mb-2 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                Custom Color…
              </button>
              <input ref={strokeCustomColorRef} type="color" className="sr-only" onChange={(e) => {
                const w = (editor.getAttributes("textStyle")?.textStrokeWidth as string) || "1px";
                editor.chain().focus().setTextStroke({ color: e.target.value, width: w }).run();
              }} />
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Stroke Weight</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {STROKE_WIDTHS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      const c = (editor.getAttributes("textStyle")?.textStrokeColor as string) || "#000000";
                      editor.chain().focus().setTextStroke({ color: c, width: w }).run();
                    }}
                    className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                      (editor.getAttributes("textStyle")?.textStrokeWidth as string) === w
                        ? "bg-brand-blue text-white border-brand-blue" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => {
                editor.chain().focus().unsetTextStroke().run();
                setShowStrokePicker(false);
              }}
                className="w-full text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                Remove Stroke
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-0.5" />

        {/* Clear formatting */}
        <Btn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Clear Formatting">
          <RemoveFormatting className={ic} />
        </Btn>
      </div>

      {/* Editor area — dark background to mimic banner */}
      <div className="relative">
        {editor.isEmpty && placeholder && (
          <div className="absolute top-2 left-3 text-white/40 text-sm pointer-events-none z-10">{placeholder}</div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
