// ProConnect — PillarGridV3 Widget
// Card-based layout using V2 data — each row rendered as a stacked card
// with icon/title header, col2 section, and col3 section

"use client";

import { useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useSounds } from "@/components/shared/SoundProvider";
import { ICON_MAP, type PillarIconName, type PillarV2Data } from "@/lib/pillar-icons";
import { renderQuickLinkIconPreview } from "@/components/widgets/QuickLinksBar";

interface PillarGridV3Props {
  data: PillarV2Data;
  cardTitleSize?: number;
  cardMessageSize?: number;
  iconSize?: number;
  col1TitleColor?: string;
  col2TitleColor?: string;
  col3TitleColor?: string;
  cellTitleColor?: string;
  cardBgOpacity?: number;
}

function renderIcon(iconName: string, className = "w-5 h-5", sizePx?: number) {
  if (iconName.startsWith("/api/pillar-icons/")) {
    const sz = sizePx ?? 28;
    return <img src={iconName} alt="" width={sz} height={sz} style={{ width: sz, height: sz, objectFit: 'contain' }} />;
  }
  const sizeStyle = sizePx ? { width: sizePx, height: sizePx } : undefined;
  const cls = sizePx ? undefined : className;
  const LegacyIcon = ICON_MAP[iconName as PillarIconName];
  if (LegacyIcon) return <LegacyIcon className={cls} style={sizeStyle} />;
  return <span style={sizeStyle}>{renderQuickLinkIconPreview(iconName, cls ?? className)}</span>;
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

export function PillarGridV3({ data, cardTitleSize = 14, cardMessageSize = 12, iconSize, col1TitleColor, col2TitleColor, col3TitleColor, cellTitleColor, cardBgOpacity = 100 }: PillarGridV3Props) {
  const { playPop } = useSounds();
  const titleAlign = data.columnTitleAlignment ?? "left";
  const colTitleSize = data.columnTitleFontSize ?? 10;
  const gridRef = useRef<HTMLDivElement>(null);

  const equalizeSections = useCallback(() => {
    const el = gridRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>("[data-pillar-card]");
    if (!cards.length) return;

    // Reset min-heights so we can measure natural sizes
    cards.forEach(card => {
      card.querySelectorAll<HTMLElement>("[data-section]").forEach(s => { s.style.minHeight = ""; });
    });

    // Determine visible column count by comparing top offsets
    let cols = 1;
    const firstTop = cards[0].getBoundingClientRect().top;
    for (let i = 1; i < cards.length; i++) {
      if (Math.abs(cards[i].getBoundingClientRect().top - firstTop) < 5) {
        cols = i + 1;
      } else break;
    }

    // Process each visual row
    const cardsArr = Array.from(cards);
    for (let i = 0; i < cardsArr.length; i += cols) {
      const rowCards = cardsArr.slice(i, Math.min(i + cols, cardsArr.length));
      (["header", "col2", "col3"] as const).forEach(section => {
        const els = rowCards
          .map(c => c.querySelector<HTMLElement>(`[data-section="${section}"]`))
          .filter(Boolean) as HTMLElement[];
        const maxH = Math.max(...els.map(s => s.scrollHeight));
        els.forEach(s => { s.style.minHeight = `${maxH}px`; });
      });
    }
  }, []);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    // Delay initial equalization to let entry animations settle
    const timer = setTimeout(equalizeSections, 600);
    const ro = new ResizeObserver(equalizeSections);
    ro.observe(el);
    return () => { clearTimeout(timer); ro.disconnect(); };
  }, [data.rows, equalizeSections]);

  return (
    <div className="w-full">
      <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            data-pillar-card
            className="rounded-xl shadow-lg overflow-hidden cursor-default group flex flex-col"
          >
            {/* Card header — icon + title */}
            <div
              data-section="header"
              className={`relative flex flex-col items-center justify-center gap-1.5 px-4 py-5 overflow-hidden`}
            >
              <div
                className={`absolute inset-0 ${!row.col1Color ? "bg-gradient-to-br from-brand-blue to-[#084f96]" : ""}`}
                style={{ opacity: cardBgOpacity / 100, ...(row.col1Color ? { backgroundColor: row.col1Color } : {}) }}
              />
              <div className="absolute -top-5 -right-5 w-20 h-20 bg-white/[0.05] rounded-full transition-transform duration-500 group-hover:scale-125" />
              <div className="absolute -bottom-3 -left-3 w-14 h-14 bg-white/[0.03] rounded-full" />

              <span
                className="relative z-10 shrink-0"
                style={{ opacity: 0.7, color: row.col1Color && isLightColor(row.col1Color) ? "#333333" : "#ffffff" }}
              >
                {renderIcon(row.col1Icon, "w-7 h-7", iconSize)}
              </span>
              <span
                className="font-bold uppercase tracking-[0.08em] relative z-10 leading-tight whitespace-pre-line text-center"
                style={{
                  fontSize: `${cardTitleSize}px`,
                  color: cellTitleColor || (row.col1Color && isLightColor(row.col1Color) ? "#333333" : "#ffffff"),
                }}
              >
                {row.col1Title}
              </span>
            </div>

            {/* Col 2 section */}
            <div
              data-section="col2"
              className="relative px-4 py-3 overflow-hidden"
            >
              <div
                className={`absolute inset-0 ${!row.col2Color ? "bg-white dark:bg-gray-800" : ""}`}
                style={{ opacity: cardBgOpacity / 100, ...(row.col2Color ? { backgroundColor: row.col2Color } : {}) }}
              />
              <p
                className={`relative z-10 font-semibold uppercase tracking-wider mb-1 ${col2TitleColor ? "" : "opacity-50"}`}
                style={{
                  fontSize: `${colTitleSize}px`,
                  textAlign: titleAlign,
                  color: col2TitleColor || (row.col2Color ? (isLightColor(row.col2Color) ? "#333333" : "#ffffff") : undefined),
                }}
              >
                {data.columnTitles[1]}
              </p>
              <div
                className={`relative z-10 font-medium leading-relaxed pillar-rich-text ${
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
              data-section="col3"
              className="relative px-4 py-3 border-t border-black/5 flex-1 overflow-hidden"
            >
              <div
                className={`absolute inset-0 ${!row.col3Color ? "bg-white dark:bg-gray-800" : ""}`}
                style={{ opacity: cardBgOpacity / 100, ...(row.col3Color ? { backgroundColor: row.col3Color } : {}) }}
              />
              <p
                className={`relative z-10 font-semibold uppercase tracking-wider mb-1 ${col3TitleColor ? "" : "opacity-50"}`}
                style={{
                  fontSize: `${colTitleSize}px`,
                  textAlign: titleAlign,
                  color: col3TitleColor || (row.col3Color ? (isLightColor(row.col3Color) ? "#333333" : "#ffffff") : undefined),
                }}
              >
                {data.columnTitles[2]}
              </p>
              <div
                className={`relative z-10 font-medium leading-relaxed pillar-rich-text ${
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
