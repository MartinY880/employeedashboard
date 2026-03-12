// ProConnect — Lightweight Rich Text Editor (Tiptap)
// Toolbar: bold, italic, underline, strikethrough, bullet list, ordered list,
//          text align (left/center/right), font color, highlight, clear formatting

"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Paintbrush,
  Type,
  RemoveFormatting,
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

function ToolbarButton({
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

const FONT_COLORS = [
  // Row 1 — basics
  "#000000", "#434343", "#666666", "#999999", "#B7B7B7", "#D9D9D9", "#FFFFFF",
  // Row 2 — vivid
  "#E03131", "#E8590C", "#F08C00", "#2F9E44", "#1971C2", "#6741D9", "#C2255C",
  // Row 3 — pastel
  "#FFC9C9", "#FFD8A8", "#FFEC99", "#B2F2BB", "#A5D8FF", "#D0BFFF", "#FCC2D7",
];

function FontColorPalette({
  currentColor,
  onSelect,
  onCustom,
}: {
  currentColor: string;
  onSelect: (color: string | null) => void;
  onCustom: () => void;
}) {
  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 w-[196px]">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {FONT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onSelect(color)}
            title={color}
            className={`w-6 h-6 rounded border transition-transform hover:scale-110 ${
              currentColor?.toLowerCase() === color.toLowerCase()
                ? "ring-2 ring-blue-500 ring-offset-1"
                : "border-gray-300 dark:border-gray-600"
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="flex-1 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onCustom}
          className="flex-1 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
        >
          Custom…
        </button>
      </div>
    </div>
  );
}

export function RichTextEditor({ value, onChange, placeholder, className = "" }: RichTextEditorProps) {
  const highlightRef = useRef<HTMLInputElement>(null);
  const customColorRef = useRef<HTMLInputElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showColorPicker]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none px-3 py-2 min-h-[60px] max-h-[200px] overflow-y-auto focus:outline-none text-sm",
      },
    },
  });

  // Sync external value changes (e.g. initial load)
  const lastExternal = useRef(value);
  useEffect(() => {
    if (!editor) return;
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      const { from, to } = editor.state.selection;
      editor.commands.setContent(value, { emitUpdate: false });
      // Restore cursor position if possible
      try {
        const maxPos = editor.state.doc.content.size;
        editor.commands.setTextSelection({ from: Math.min(from, maxPos), to: Math.min(to, maxPos) });
      } catch { /* ignore */ }
    }
  }, [value, editor]);

  // Update lastExternal when user edits
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      lastExternal.current = editor.getHTML();
    };
    editor.on("update", handler);
    return () => { editor.off("update", handler); };
  }, [editor]);

  if (!editor) return null;

  const iconSize = "w-3.5 h-3.5";

  return (
    <div className={`relative border border-gray-200 dark:border-gray-700 rounded-lg overflow-visible bg-white dark:bg-gray-900 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <Strikethrough className={iconSize} />
        </ToolbarButton>

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-0.5" />

        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <List className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered List"
        >
          <ListOrdered className={iconSize} />
        </ToolbarButton>

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-0.5" />

        <ToolbarButton
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Align Left"
        >
          <AlignLeft className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Align Center"
        >
          <AlignCenter className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Align Right"
        >
          <AlignRight className={iconSize} />
        </ToolbarButton>

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-0.5" />

        {/* Font Color Dropdown */}
        <div className="relative" ref={colorPickerRef}>
          <ToolbarButton
            onClick={() => setShowColorPicker((p) => !p)}
            title="Font Color"
          >
            <div className="flex flex-col items-center gap-0">
              <Type className={iconSize} />
              <div
                className="w-3 h-0.5 rounded-full"
                style={{
                  backgroundColor:
                    (editor.getAttributes("textStyle")?.color as string) || "#000000",
                }}
              />
            </div>
          </ToolbarButton>
          {showColorPicker && (
            <FontColorPalette
              currentColor={(editor.getAttributes("textStyle")?.color as string) || ""}
              onSelect={(color) => {
                if (color) {
                  editor.chain().focus().setColor(color).run();
                } else {
                  editor.chain().focus().unsetColor().run();
                }
                setShowColorPicker(false);
              }}
              onCustom={() => {
                customColorRef.current?.click();
              }}
            />
          )}
          <input
            ref={customColorRef}
            type="color"
            className="sr-only"
            onChange={(e) => {
              editor.chain().focus().setColor(e.target.value).run();
              setShowColorPicker(false);
            }}
          />
        </div>

        {/* Highlight */}
        <ToolbarButton
          active={editor.isActive("highlight")}
          onClick={() => highlightRef.current?.click()}
          title="Highlight"
        >
          <Paintbrush className={iconSize} />
          <input
            ref={highlightRef}
            type="color"
            defaultValue="#fef08a"
            className="sr-only"
            onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
          />
        </ToolbarButton>

        {/* Clear formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          title="Clear Formatting"
        >
          <RemoveFormatting className={iconSize} />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div className="relative">
        {editor.isEmpty && placeholder && (
          <div className="absolute top-2 left-3 text-gray-400 text-sm pointer-events-none">
            {placeholder}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
