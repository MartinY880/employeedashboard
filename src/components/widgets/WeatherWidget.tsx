"use client";

import * as React from "react";
import { CloudSun } from "lucide-react";

interface WeatherData {
  temp: number | null;
  icon: string | null;
  condition: string | null;
  location: string | null;
}

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export function WeatherWidget() {
  const [weather, setWeather] = React.useState<WeatherData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchWeather = React.useCallback(async () => {
    try {
      const response = await fetch("/api/weather/current", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to load weather.");
      }

      setWeather({
        temp: typeof data?.temp === "number" ? data.temp : null,
        icon: typeof data?.icon === "string" ? data.icon : null,
        condition: typeof data?.condition === "string" ? data.condition : null,
        location: typeof data?.location === "string" ? data.location : null,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load weather.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchWeather();

    const intervalId = window.setInterval(() => {
      void fetchWeather();
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchWeather]);

  const location = weather?.location || "Local Weather";
  const roundedTemp = typeof weather?.temp === "number" ? Math.round(weather.temp) : null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">Weather</h3>
        <CloudSun className="w-4 h-4 text-brand-blue" />
      </div>

      <div className="p-4 min-h-[88px]">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3.5 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
          </div>
        ) : error ? (
          <div className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
            <p className="font-semibold">Weather unavailable</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate">{location}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {roundedTemp !== null ? `${roundedTemp}°F` : "--"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">{weather?.condition || "Current conditions"}</p>
            </div>

            {weather?.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                alt={weather?.condition || "Weather icon"}
                className="w-14 h-14 shrink-0"
              />
            ) : (
              <CloudSun className="w-10 h-10 text-gray-400 dark:text-gray-500 shrink-0" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
