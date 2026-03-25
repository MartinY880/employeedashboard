// ProConnect — Pie Chart (SVG-based, no external charting library)
// Used by Active Pipeline widget to display loan stage distribution.

"use client";

interface PieChartDatum {
  label: string;
  value: number;
}

interface PieChartProps {
  data: PieChartDatum[];
  size?: number;
  className?: string;
}

// Tailwind-friendly palette for up to 12 slices
const SLICE_COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#14b8a6", // teal-500
  "#6366f1", // indigo-500
  "#84cc16", // lime-500
  "#a855f7", // purple-500
];

export function PieChart({ data, size = 200, className = "" }: PieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <span className="text-sm text-brand-grey">No data</span>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <span className="text-sm text-brand-grey">No data</span>
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 4; // small padding for stroke
  const innerRadius = radius * 0.55; // donut style

  // Build slices
  let currentAngle = -Math.PI / 2; // start at top
  const slices = data.map((d, i) => {
    const sliceAngle = (d.value / total) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    // Outer arc
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    // Inner arc (for donut)
    const ix1 = cx + innerRadius * Math.cos(endAngle);
    const iy1 = cy + innerRadius * Math.sin(endAngle);
    const ix2 = cx + innerRadius * Math.cos(startAngle);
    const iy2 = cy + innerRadius * Math.sin(startAngle);

    const pathData =
      data.length === 1
        ? // Full circle: draw two semicircles
          [
            `M ${cx + radius} ${cy}`,
            `A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy}`,
            `A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy}`,
            `Z`,
            `M ${cx + innerRadius} ${cy}`,
            `A ${innerRadius} ${innerRadius} 0 1 0 ${cx - innerRadius} ${cy}`,
            `A ${innerRadius} ${innerRadius} 0 1 0 ${cx + innerRadius} ${cy}`,
            `Z`,
          ].join(" ")
        : [
            `M ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            `L ${ix1} ${iy1}`,
            `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}`,
            `Z`,
          ].join(" ");

    const color = SLICE_COLORS[i % SLICE_COLORS.length];

    return { pathData, color, label: d.label, value: d.value, pct: ((d.value / total) * 100).toFixed(0) };
  });

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-3 ${className}`}>
      {/* SVG Donut */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {slices.map((s, i) => (
          <path
            key={i}
            d={s.pathData}
            fill={s.color}
            fillRule="evenodd"
            className="transition-opacity hover:opacity-80"
          >
            <title>{`${s.label}: ${s.value} (${s.pct}%)`}</title>
          </path>
        ))}
        {/* Center text: total */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-gray-900 dark:fill-gray-100 text-lg font-bold"
          style={{ fontSize: size * 0.12 }}
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + size * 0.07}
          textAnchor="middle"
          className="fill-gray-400 dark:fill-gray-500"
          style={{ fontSize: size * 0.065 }}
        >
          Total
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-col gap-1 min-w-0">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs min-w-0">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-gray-700 dark:text-gray-300 truncate">
              {s.label}
            </span>
            <span className="text-brand-grey font-medium ml-auto whitespace-nowrap">
              {s.value} ({s.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
