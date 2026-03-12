// ProConnect — PillarGridV2 Widget
// 5-row × 3-column grid layout for company pillars (v2 template)
// Col 1: icon + title | Col 2: text | Col 3: text

"use client";

import { motion } from "framer-motion";
import { useSounds } from "@/components/shared/SoundProvider";
import { ICON_MAP, type PillarIconName, type PillarV2Data } from "@/lib/pillar-icons";
import { renderQuickLinkIconPreview } from "@/components/widgets/QuickLinksBar";

interface PillarGridV2Props {
  data: PillarV2Data;
  cardTitleSize?: number;
  cardMessageSize?: number;
}

function renderIcon(iconName: string, className = "w-5 h-5") {
  const LegacyIcon = ICON_MAP[iconName as PillarIconName];
  if (LegacyIcon) return <LegacyIcon className={className} />;
  return renderQuickLinkIconPreview(iconName, className);
}

/**
 * Propagate inline text color from inner <span> to parent <li> so that
 * ::marker (bullet / number) inherits the correct color.
 * Tiptap output: <li><p><span style="color: #fff">text</span></p></li>
 * We copy the first color we find inside each <li> onto the <li> itself.
 */
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

/** Returns true if the given hex color is "light" (should use dark text). */
function isLightColor(hex: string | undefined): boolean {
  if (!hex) return false;
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Perceived brightness formula
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

export function PillarGridV2({ data, cardTitleSize = 14, cardMessageSize = 12 }: PillarGridV2Props) {
  const { playPop } = useSounds();
  const [w1, w2, w3] = data.columnWidths ?? [33, 34, 33];
  const gridCols = `${w1}fr ${w2}fr ${w3}fr`;
  const titleAlign = data.columnTitleAlignment ?? "left";
  const colTitleSize = data.columnTitleFontSize ?? 10;

  return (
    <div className="w-full">
      {/* ── Desktop: 3-column grid (md+) ───────────────── */}
      <div className="hidden md:block">
        {/* Column Headers */}
        <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: gridCols }}>
          {data.columnTitles.map((title, colIdx) => (
            <motion.div
              key={colIdx}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: colIdx * 0.08 }}
              className="bg-gradient-to-br from-brand-blue to-[#084f96] text-white rounded-xl px-4 py-2.5 text-center shadow-md"
            >
              <span
                className="font-bold uppercase tracking-[0.12em]"
                style={{ fontSize: `${cardTitleSize}px` }}
              >
                {title}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Grid Rows */}
        {data.rows.map((row, rowIdx) => (
          <div key={row.id} className="grid gap-3 mb-3" style={{ gridTemplateColumns: gridCols }}>
            {/* Column 1: Icon + Title */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.1 + rowIdx * 0.07 }}
              whileHover={{
                y: -3,
                boxShadow: "0 10px 24px rgba(6, 66, 127, 0.2)",
                transition: { duration: 0.2 },
              }}
              onHoverStart={playPop}
              className={`relative px-4 py-4 rounded-xl shadow-lg flex flex-col items-center justify-center gap-1.5 cursor-default overflow-hidden group ${!row.col1Color ? "bg-gradient-to-br from-brand-blue to-[#084f96]" : ""}`}
              style={row.col1Color ? { backgroundColor: row.col1Color } : undefined}
            >
              <div className="absolute -top-5 -right-5 w-20 h-20 bg-white/[0.05] rounded-full transition-transform duration-500 group-hover:scale-125" />
              <div className="absolute -bottom-3 -left-3 w-14 h-14 bg-white/[0.03] rounded-full" />
              <span className="relative z-10 shrink-0" style={{ opacity: 0.7, color: row.col1Color && isLightColor(row.col1Color) ? "#333333" : "#ffffff" }}>
                {renderIcon(row.col1Icon, "w-7 h-7")}
              </span>
              <span
                className="font-bold uppercase tracking-[0.08em] relative z-10 leading-tight whitespace-pre-line text-center"
                style={{ fontSize: `${cardTitleSize}px`, color: row.col1Color && isLightColor(row.col1Color) ? "#333333" : "#ffffff" }}
              >
                {row.col1Title}
              </span>
            </motion.div>

            {/* Column 2 */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.15 + rowIdx * 0.07 }}
              whileHover={{
                y: -3,
                boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
                transition: { duration: 0.2 },
              }}
              onHoverStart={playPop}
              className={`relative px-4 py-4 rounded-xl shadow-lg flex items-center cursor-default overflow-hidden group ${
                !row.col2Color ? "bg-white dark:bg-gray-800" : ""
              }`}
              style={row.col2Color ? { backgroundColor: row.col2Color } : undefined}
            >
              <div
                className={`font-medium leading-relaxed relative z-10 pillar-rich-text ${
                  !row.col2Color ? "text-gray-800 dark:text-gray-100" : ""
                }`}
                style={{
                  fontSize: `${cardMessageSize}px`,
                  color: row.col2Color
                    ? isLightColor(row.col2Color)
                      ? "#333333"
                      : "#ffffff"
                    : undefined,
                }}
                dangerouslySetInnerHTML={{ __html: propagateListItemColors(row.col2Text) }}
              />
            </motion.div>

            {/* Column 3 */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.2 + rowIdx * 0.07 }}
              whileHover={{
                y: -3,
                boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
                transition: { duration: 0.2 },
              }}
              onHoverStart={playPop}
              className={`relative px-4 py-4 rounded-xl shadow-lg flex items-center cursor-default overflow-hidden group ${
                !row.col3Color ? "bg-white dark:bg-gray-800" : ""
              }`}
              style={row.col3Color ? { backgroundColor: row.col3Color } : undefined}
            >
              <div
                className={`font-medium leading-relaxed relative z-10 pillar-rich-text ${
                  !row.col3Color ? "text-gray-800 dark:text-gray-100" : ""
                }`}
                style={{
                  fontSize: `${cardMessageSize}px`,
                  color: row.col3Color
                    ? isLightColor(row.col3Color)
                      ? "#333333"
                      : "#ffffff"
                    : undefined,
                }}
                dangerouslySetInnerHTML={{ __html: propagateListItemColors(row.col3Text) }}
              />
            </motion.div>
          </div>
        ))}
      </div>

      {/* ── Mobile: stacked cards (<md) ────────────────── */}
      <div className="md:hidden space-y-3">
        {data.rows.map((row, rowIdx) => (
          <motion.div
            key={row.id}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, delay: rowIdx * 0.06 }}
            className="rounded-xl shadow-lg overflow-hidden"
          >
            {/* Card header — icon + title (full width) */}
            <div
              className={`flex items-center gap-3 px-4 py-3 ${!row.col1Color ? "bg-gradient-to-br from-brand-blue to-[#084f96]" : ""}`}
              style={row.col1Color ? { backgroundColor: row.col1Color } : undefined}
            >
              <span className="shrink-0" style={{ opacity: 0.7, color: row.col1Color && isLightColor(row.col1Color) ? "#333333" : "#ffffff" }}>
                {renderIcon(row.col1Icon, "w-6 h-6")}
              </span>
              <span
                className="font-bold uppercase tracking-[0.08em] leading-tight"
                style={{ fontSize: `${cardTitleSize}px`, color: row.col1Color && isLightColor(row.col1Color) ? "#333333" : "#ffffff" }}
              >
                {row.col1Title}
              </span>
            </div>

            {/* Col 2 section */}
            <div
              className={`px-4 py-3 border-t border-black/5 ${!row.col2Color ? "bg-white dark:bg-gray-800" : ""}`}
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
                    ? isLightColor(row.col2Color)
                      ? "#333333"
                      : "#ffffff"
                    : undefined,
                }}
                dangerouslySetInnerHTML={{ __html: propagateListItemColors(row.col2Text) }}
              />
            </div>

            {/* Col 3 section */}
            <div
              className={`px-4 py-3 border-t border-black/5 ${!row.col3Color ? "bg-white dark:bg-gray-800" : ""}`}
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
                    ? isLightColor(row.col3Color)
                      ? "#333333"
                      : "#ffffff"
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
