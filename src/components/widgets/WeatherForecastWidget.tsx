"use client";

import * as React from "react";
import { CloudSun, Sun, Moon, Cloud, CloudMoon, CloudRain, CloudDrizzle, CloudLightning, CloudSnow, Wind } from "lucide-react";

interface ForecastDay {
  date: string;
  dayLabel: string;
  icon: string | null;
  condition: string | null;
  minTemp: number | null;
  maxTemp: number | null;
}

interface ForecastData {
  location: string | null;
  currentIcon: string | null;
  days: ForecastDay[];
  updatedAt: string;
}

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

type WeatherIconInfo = { Icon: React.ElementType; className: string };

function getWeatherIcon(iconCode: string | null): WeatherIconInfo {
  if (!iconCode) return { Icon: CloudSun, className: "text-brand-blue dark:text-blue-300" };
  const prefix = iconCode.slice(0, 2);
  const isNight = iconCode.endsWith("n");
  switch (prefix) {
    case "01":
      return isNight
        ? { Icon: Moon, className: "text-slate-400 dark:text-slate-200" }
        : { Icon: Sun, className: "text-amber-500 dark:text-amber-300" };
    case "02":
      return isNight
        ? { Icon: CloudMoon, className: "text-slate-400 dark:text-slate-200" }
        : { Icon: CloudSun, className: "text-amber-500 dark:text-amber-300" };
    case "03":
    case "04":
      return { Icon: Cloud, className: "text-gray-500 dark:text-gray-200" };
    case "09":
      return { Icon: CloudDrizzle, className: "text-blue-500 dark:text-blue-300" };
    case "10":
      return { Icon: CloudRain, className: "text-blue-600 dark:text-blue-300" };
    case "11":
      return { Icon: CloudLightning, className: "text-amber-600 dark:text-amber-300" };
    case "13":
      return { Icon: CloudSnow, className: "text-sky-500 dark:text-sky-300" };
    case "50":
      return { Icon: Wind, className: "text-slate-500 dark:text-slate-200" };
    default:
      return { Icon: CloudSun, className: "text-brand-blue dark:text-blue-300" };
  }
}

export function WeatherForecastWidget() {
  const [forecast, setForecast] = React.useState<ForecastData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchForecast = React.useCallback(async () => {
    try {
      const response = await fetch("/api/weather/forecast");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to load forecast.");
      }

      setForecast({
        location: typeof data?.location === "string" ? data.location : null,
        currentIcon: typeof data?.currentIcon === "string" ? data.currentIcon : null,
        days: Array.isArray(data?.days) ? data.days : [],
        updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load forecast.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchForecast();
    const intervalId = window.setInterval(() => {
      void fetchForecast();
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchForecast]);

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-3.5 py-2 bg-gradient-to-r from-slate-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">Weather</h3>
          <CloudSun className="w-4 h-4 text-brand-blue" />
        </div>
        <div className="flex-1 p-3.5 animate-pulse">
          <div className="h-2.5 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-full grid grid-cols-5 gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-full min-h-[88px] rounded-lg bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-3.5 py-2 bg-gradient-to-r from-slate-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">Weather</h3>
        {(() => {
          const { Icon, className } = getWeatherIcon(forecast?.currentIcon ?? forecast?.days?.[0]?.icon ?? null);
          return <Icon className={`w-4 h-4 ${className}`} strokeWidth={1.8} />;
        })()}
      </div>

      <div className="flex-1 flex flex-col p-3.5">
        {error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-xs text-red-600 dark:text-red-400 leading-relaxed text-center">
              <p className="font-semibold">Forecast unavailable</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-2 truncate">
              {forecast?.location || "Local Weather"}
            </p>
            <div className="flex-1 grid grid-cols-5 gap-1.5 sm:gap-2 min-h-0">
              {(forecast?.days || []).slice(0, 5).map((day) => {
                const { Icon, className } = getWeatherIcon(day.icon);
                return (
                  <div
                    key={day.date}
                    className="h-full flex flex-col items-center justify-between text-center rounded-lg border border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/50 px-1.5 py-2.5"
                  >
                    <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300 leading-none tracking-wide uppercase">
                      {day.dayLabel}
                    </p>
                    <Icon className={`w-7 h-7 mt-1 ${className}`} strokeWidth={1.8} />
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 capitalize leading-tight line-clamp-2 px-0.5 w-full mt-1">
                      {day.condition || ""}
                    </p>
                    <div className="mt-1.5 flex flex-col items-center">
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-none">
                        {day.maxTemp !== null ? `${day.maxTemp}°` : "--"}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {day.minTemp !== null ? `${day.minTemp}°` : "--"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
