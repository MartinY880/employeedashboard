import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface OpenWeatherForecastResponse {
  city?: {
    name?: string;
  };
  list?: Array<{
    dt?: number;
    dt_txt?: string;
    main?: {
      temp?: number;
      temp_min?: number;
      temp_max?: number;
    };
    weather?: Array<{
      icon?: string;
      main?: string;
      description?: string;
    }>;
  }>;
}

interface ForecastDay {
  date: string;
  dayLabel: string;
  icon: string | null;
  condition: string | null;
  minTemp: number | null;
  maxTemp: number | null;
}

interface ForecastPayload {
  location: string | null;
  currentIcon: string | null;
  days: ForecastDay[];
  updatedAt: string;
}

const WEATHER_CACHE_TTL_MS = 20 * 60 * 1000;

let forecastCache: {
  data: ForecastPayload;
  expiresAt: number;
} | null = null;

function toDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function pickRepresentativeIcon(entries: Array<NonNullable<OpenWeatherForecastResponse["list"]>[number]>): {
  icon: string | null;
  condition: string | null;
} {
  const midday = entries.find((e) => e.dt_txt?.includes("12:00:00"));
  const chosen = midday ?? entries[Math.floor(entries.length / 2)] ?? entries[0];
  return {
    icon: chosen?.weather?.[0]?.icon ?? null,
    condition: chosen?.weather?.[0]?.main ?? chosen?.weather?.[0]?.description ?? null,
  };
}

export async function GET() {
  if (forecastCache && forecastCache.expiresAt > Date.now()) {
    return NextResponse.json(forecastCache.data);
  }

  let apiKey = process.env.OPENWEATHER_API_KEY?.trim() || "";
  let city = process.env.OPENWEATHER_CITY?.trim() || "";
  let latitude = process.env.OPENWEATHER_LATITUDE?.trim() || "";
  let longitude = process.env.OPENWEATHER_LONGITUDE?.trim() || "";

  try {
    const weatherSetting = await prisma.calendarSetting.findUnique({ where: { id: "weather_settings" } });
    if (weatherSetting?.data) {
      const parsed = JSON.parse(weatherSetting.data) as {
        city?: string;
        apiKey?: string;
      };
      if (typeof parsed.apiKey === "string" && parsed.apiKey.trim()) {
        apiKey = parsed.apiKey.trim();
      }
      if (typeof parsed.city === "string" && parsed.city.trim()) {
        city = parsed.city.trim();
      }
    }
  } catch {
    // Fall back to env configuration when DB settings are unavailable.
  }

  if (!apiKey || (!city && (!latitude || !longitude))) {
    return NextResponse.json({ error: "Weather settings are not configured." }, { status: 500 });
  }

  const url = city
    ? `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=imperial&appid=${encodeURIComponent(apiKey)}`
    : `https://api.openweathermap.org/data/2.5/forecast?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&units=imperial&appid=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      let upstreamMessage = "Unable to load forecast right now.";
      try {
        const upstream = (await response.json()) as { message?: string };
        if (typeof upstream.message === "string" && upstream.message.trim()) {
          upstreamMessage = upstream.message;
        }
      } catch {
        // Ignore response body parse errors and use default message.
      }

      if (response.status === 401) {
        return NextResponse.json(
          { error: "OpenWeather rejected the API key. Please verify Weather Settings in Admin Branding." },
          { status: 502 }
        );
      }

      return NextResponse.json({ error: upstreamMessage }, { status: 502 });
    }

    const data = (await response.json()) as OpenWeatherForecastResponse;
    const entries = data.list ?? [];
    const currentIcon = entries[0]?.weather?.[0]?.icon ?? null;

    const grouped = new Map<string, Array<NonNullable<OpenWeatherForecastResponse["list"]>[number]>>();
    for (const entry of entries) {
      const dt = typeof entry.dt === "number" ? new Date(entry.dt * 1000) : null;
      if (!dt) continue;
      const key = dt.toISOString().slice(0, 10);
      const existing = grouped.get(key) ?? [];
      existing.push(entry);
      grouped.set(key, existing);
    }

    const todayKey = new Date().toISOString().slice(0, 10);
    const days: ForecastDay[] = Array.from(grouped.entries())
      .filter(([key]) => key >= todayKey)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([key, dayEntries]) => {
        const tempsMin = dayEntries.map((e) => e.main?.temp_min).filter((t): t is number => typeof t === "number");
        const tempsMax = dayEntries.map((e) => e.main?.temp_max).filter((t): t is number => typeof t === "number");
        const iconData = pickRepresentativeIcon(dayEntries);
        const date = new Date(`${key}T12:00:00Z`);

        return {
          date: key,
          dayLabel: toDayLabel(date),
          icon: iconData.icon,
          condition: iconData.condition,
          minTemp: tempsMin.length ? Math.round(Math.min(...tempsMin)) : null,
          maxTemp: tempsMax.length ? Math.round(Math.max(...tempsMax)) : null,
        };
      });

    const payload: ForecastPayload = {
      location: data.city?.name ?? (city || null),
      currentIcon,
      days,
      updatedAt: new Date().toISOString(),
    };

    forecastCache = {
      data: payload,
      expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=120, s-maxage=1200, stale-while-revalidate=2400",
      },
    });
  } catch {
    if (forecastCache?.data) {
      return NextResponse.json(forecastCache.data);
    }

    return NextResponse.json(
      { error: "Weather service is temporarily unavailable." },
      { status: 502 }
    );
  }
}
