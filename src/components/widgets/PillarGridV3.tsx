// ProConnect — PillarGridV3 Widget
// Card-based layout using V2 data — each row rendered as a stacked card
// with icon/title header, col2 section, and col3 section

"use client";

import { motion } from "framer-motion";
import { useSounds } from "@/components/shared/SoundProvider";
import { ICON_MAP, type PillarIconName, type PillarV2Data } from "@/lib/pillar-icons";
import { renderQuickLinkIconPreview } from "@/components/widgets/QuickLinksBar";

interface PillarGridV3Props {
  data: PillarV2Data;
  cardTitleSize?: number;
  cardMessageSize?: number;
}

function renderIcon(iconName: string, className = "w-5 h-5") {
  const LegacyIcon = ICON_MAP[iconName as PillarIconName];
  if (LegacyIcon) return <LegacyIcon className={className} />;
  return renderQuickLinkIconPreview(iconName, className);
}

function propagateListItemColors(html: string): string {
  return html.replace(/<li>([\s\S]*?)<\/li>/g, (match, inner) => {
    const colorMatch = inner.match(/style="[^"]*color:\s*([^;"]+)/);
    if (colorMatch) {
      const color = colorMatch[1].trim();
      return `<li style="color: ${color}">${inner}</li>`;
    }
    return match;
  });
}

function isLightColor(hex: string | undefined): boolean {
  if (!hex) return false;
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

export function PillarGridV3({ data, cardTitleSize = 14, cardMessageSize = 12 }: PillarGridV3Props) {
  const { playPop } = useSounds();
  const titleAlign = data.columnTitleAlignment ?? "left";
  const colTitleSize = data.columnTitleFontSize ?? 10;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.rows.map((row, rowIdx) => (
          <motion.div
            key={row.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.1 + rowIdx * 0.07, ease: "easeOut" }}
            whileHover={{
              y: -4,
              boxShadow: "0 12px 28px rgba(6, 66, 127, 0.2)",
              transition: { duration: 0.2 },
            }}
            onHoverStart={playPop}
            className="rounded-xl shadow-lg overflow-hidden cursor-default group flex flex-col"
          >
            {/* Card header — icon + title */}
            <div
              className={`relative flex flex-col items-center justify-center gap-1.5 px-4 py-5 overflow-hidden ${
                !row.col1Color ? "bg-gradient-to-br from-brand-blue to-[#084f96]" : ""
              }`}
              style={row.col1Color ? { backgroundColor: row.col1Color } : undefined}
            >
              <div className="absolute -top-5 -right-5 w-20 h-20 bg-white/[0.05] rounded-full transition-transform duration-500 group-hover:scale-125" />
              <div className="absolute -bottom-3 -left-3 w-14 h-14 bg-white/[0.03] rounded-full" />

              <span
                className="relative z-10 shrink-0"
                style={{ opacity: 0.7, color: row.col1Color && isLightColor(row.col1Color) ? "#333333" : "#ffffff" }}
              >
                {renderIcon(row.col1Icon, "w-7 h-7")}
              </span>
              <span
                className="font-bold uppercase tracking-[0.08em] relative z-10 leading-tight whitespace-pre-line text-center"
                style={{
                  fontSize: `${cardTitleSize}px`,
                  color: row.col1Color && isLightColor(row.col1Color) ? "#333333" : "#ffffff",
                }}
              >
                {row.col1Title}
              </span>
            </div>

            {/* Col 2 section */}
            <div
              className={`px-4 py-3 ${!row.col2Color ? "bg-white dark:bg-gray-800" : ""}`}
              style={row.col2Color ? { backgroundColor: row.col2Color } : undefined}
            >
              <p
                className="font-semibold uppercase tracking-wider mb-1 opacity-50"
                style={{
                  fontSize: `${colTitleSize}px`,
                  textAlign: titleAlign,
                  color: row.col2Color ? (isLightColor(row.col2Color) ? "#333333" : "#ffffff") : undefined,
                }}
              >
                {data.columnTitles[1]}
              </p>
              <div
                className={`font-medium leading-relaxed pillar-rich-text ${
                  !row.col2Color ? "text-gray-800 dark:text-gray-100" : ""
                }`}
                style={{
                  fontSize: `${cardMessageSize}px`,
                  color: row.col2Color
                    ? isLightColor(row.col2Color) ? "#333333" : "#ffffff"
                    : undefined,
                }}
                dangerouslySetInnerHTML={{ __html: propagateListItemColors(row.col2Text) }}
              />
            </div>

            {/* Col 3 section */}
            <div
              className={`px-4 py-3 border-t border-black/5 flex-1 ${!row.col3Color ? "bg-white dark:bg-gray-800" : ""}`}
              style={row.col3Color ? { backgroundColor: row.col3Color } : undefined}
            >
              <p
                className="font-semibold uppercase tracking-wider mb-1 opacity-50"
                style={{
                  fontSize: `${colTitleSize}px`,
                  textAlign: titleAlign,
                  color: row.col3Color ? (isLightColor(row.col3Color) ? "#333333" : "#ffffff") : undefined,
                }}
              >
                {data.columnTitles[2]}
              </p>
              <div
                className={`font-medium leading-relaxed pillar-rich-text ${
                  !row.col3Color ? "text-gray-800 dark:text-gray-100" : ""
                }`}
                style={{
                  fontSize: `${cardMessageSize}px`,
                  color: row.col3Color
                    ? isLightColor(row.col3Color) ? "#333333" : "#ffffff"
                    : undefined,
                }}
                dangerouslySetInnerHTML={{ __html: propagateListItemColors(row.col3Text) }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
