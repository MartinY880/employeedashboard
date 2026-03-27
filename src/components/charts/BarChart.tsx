"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { useState, useEffect, useRef } from "react";

interface BarChartDatum {
  label: string;
  value: number;
}

type BarUnits = "currency" | "number" | "percent";

type BarLayout = "vertical" | "horizontal";

interface BarChartProps {
  data: BarChartDatum[];
  units?: BarUnits;
  layout?: BarLayout;
  className?: string;
}

/* ── helpers ─────────────────────────────────────────── */

function toFirstName(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "Unknown";
  const first = trimmed.split(/\s+/)[0] || "Unknown";
  return first.length > 10 ? `${first.slice(0, 9)}…` : first;
}

function abbreviate(n: number, units: BarUnits = "currency"): string {
  if (units === "percent") return `${+(n).toFixed(1)}%`;
  const prefix = units === "currency" ? "$" : "";
  if (n >= 1_000_000) return `${prefix}${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${+(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n}`;
}

function formatFull(n: number, units: BarUnits = "currency"): string {
  if (units === "percent") return `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
  if (units === "currency") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }
  return n.toLocaleString("en-US");
}

/* ── custom tooltip ──────────────────────────────────── */

function CustomTooltip({
  active,
  payload,
  units,
}: {
  active?: boolean;
  payload?: Array<{ payload: { fullName: string; value: number } }>;
  units?: BarUnits;
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg bg-gray-900/95 dark:bg-gray-800/95 px-3 py-2 shadow-xl border border-white/10 backdrop-blur-sm">
      <p className="text-[11px] text-gray-300 mb-0.5">{d.fullName}</p>
      <p className="text-sm font-semibold text-white">{formatFull(d.value, units)}</p>
    </div>
  );
}

/* ── custom bar shape with rounded top ───────────────── */

function RoundedBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill } = props;
  if (height <= 0 || width <= 0) return null;
  const r = Math.min(6, width / 2);
  return (
    <path
      d={`M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`}
      fill={fill}
    />
  );
}

/* ── main component ──────────────────────────────────── */

export function BarChart({ data, units = "currency", layout = "vertical", className = "" }: BarChartProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  /* Measure the wrapper once mounted + on resize */
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setDims((prev) =>
        prev && Math.abs(prev.w - width) < 2 && Math.abs(prev.h - height) < 2
          ? prev
          : { w: width, h: height },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center py-10 ${className}`}>
        <span className="text-sm text-brand-grey">No data</span>
      </div>
    );
  }

  const chartData = data
    .map((d) => ({
      name: toFirstName(d.label),
      fullName: d.label || "Unknown",
      value: Number(d.value) || 0,
    }))
    .filter((d) => d.value >= 0);

  if (chartData.length === 0 || Math.max(...chartData.map((d) => d.value)) === 0) {
    return (
      <div className={`flex items-center justify-center py-10 ${className}`}>
        <span className="text-sm text-brand-grey">No data</span>
      </div>
    );
  }

  const isHorizontal = layout === "horizontal";

  return (
    <div ref={wrapperRef} className={`w-full h-full ${className}`}>
      {dims && dims.w > 0 && dims.h > 0 && (
        <RechartsBarChart
          layout={isHorizontal ? "vertical" : "horizontal"}
          width={dims.w}
          height={dims.h}
          data={chartData}
          margin={isHorizontal
            ? { top: 4, right: 12, bottom: 0, left: 4 }
            : { top: 8, right: 8, bottom: 0, left: -4 }
          }
          barCategoryGap="20%"
        >
          <defs>
            <linearGradient id="barGradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#06427F" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="barGradientH" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06427F" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical={isHorizontal}
            horizontal={!isHorizontal}
            strokeDasharray="4 4"
            stroke="#e5e7eb"
            strokeOpacity={0.45}
          />

          {isHorizontal ? (
            <>
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => abbreviate(v, units)}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                height={22}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                width={60}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                dy={2}
                height={22}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => abbreviate(v, units)}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                width={48}
              />
            </>
          )}

          <Tooltip
            content={<CustomTooltip units={units} />}
            cursor={{ fill: "rgba(6,66,127,0.06)" }}
          />

          <Bar
            dataKey="value"
            shape={isHorizontal ? undefined : <RoundedBar />}
            radius={isHorizontal ? [0, 6, 6, 0] : undefined}
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={isHorizontal ? "url(#barGradientH)" : "url(#barGradient)"} />
            ))}
          </Bar>
        </RechartsBarChart>
      )}
    </div>
  );
}
