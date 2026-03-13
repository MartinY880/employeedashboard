// Tiptap TextStroke extension — adds text stroke (outline) to TextStyle mark
// Renders as -webkit-text-stroke + paint-order: stroke fill
import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textStroke: {
      setTextStroke: (options: { color: string; width: string }) => ReturnType;
      unsetTextStroke: () => ReturnType;
    };
  }
}

export const TextStroke = Extension.create({
  name: "textStroke",

  addOptions() {
    return { types: ["textStyle"] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textStrokeColor: {
            default: null,
            parseHTML: (element) => {
              const stroke = element.style.webkitTextStroke || element.style.getPropertyValue("-webkit-text-stroke");
              if (!stroke) return null;
              // Extract color from value like "2px #000000"
              const match = stroke.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-z]+$/i);
              return match ? match[0] : null;
            },
            renderHTML: () => ({}), // rendered together below
          },
          textStrokeWidth: {
            default: null,
            parseHTML: (element) => {
              const stroke = element.style.webkitTextStroke || element.style.getPropertyValue("-webkit-text-stroke");
              if (!stroke) return null;
              const match = stroke.match(/[\d.]+px/);
              return match ? match[0] : null;
            },
            renderHTML: (attributes) => {
              const { textStrokeColor, textStrokeWidth } = attributes;
              if (!textStrokeColor && !textStrokeWidth) return {};
              const w = textStrokeWidth || "1px";
              const c = textStrokeColor || "#000000";
              return {
                style: `-webkit-text-stroke: ${w} ${c}; paint-order: stroke fill`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextStroke:
        ({ color, width }) =>
        ({ chain }) =>
          chain().setMark("textStyle", { textStrokeColor: color, textStrokeWidth: width }).run(),
      unsetTextStroke:
        () =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", { textStrokeColor: null, textStrokeWidth: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});
