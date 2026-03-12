import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface OpenWeatherResponse {
  main?: {
    temp?: number;
  };
  weather?: Array<{
    icon?: string;
    main?: string;
    description?: string;
  }>;
  name?: string;
}

interface WeatherPayload {
  temp: number | null;
  icon: string | null;
  condition: string | null;
  location: string | null;
}

const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;

let weatherCache: {
  data: WeatherPayload;
  expiresAt: number;
} | null = null;

export async function GET() {
  if (weatherCache && weatherCache.expiresAt > Date.now()) {
    return NextResponse.json(weatherCache.data);
  }

  // API key: ENV only — never stored in DB
  const apiKey = process.env.OPENWEATHER_API_KEY?.trim() || "";
  const latitude = process.env.OPENWEATHER_LATITUDE?.trim() || "";
  const longitude = process.env.OPENWEATHER_LONGITUDE?.trim() || "";

  // City: ENV first, DB fallback (stored as plain string; handle legacy JSON gracefully)
  let city = process.env.OPENWEATHER_CITY?.trim() || "";
  if (!city) {
    try {
      const weatherSetting = await prisma.calendarSetting.findUnique({ where: { id: "weather_settings" } });
      if (weatherSetting?.data?.trim()) {
        try {
          const parsed = JSON.parse(weatherSetting.data) as { city?: string };
          if (parsed.city?.trim()) city = parsed.city.trim();
        } catch {
          city = weatherSetting.data.trim();
        }
      }
    } catch {
      // DB unavailable — city remains empty
    }
  }

  if (!apiKey || (!city && (!latitude || !longitude))) {
    return NextResponse.json(
      { error: "Weather settings are not configured." },
      { status: 500 },
    );
  }

  const url = city
    ? `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=imperial&appid=${encodeURIComponent(apiKey)}`
    : `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&units=imperial&appid=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      let upstreamMessage = "Unable to load weather right now.";
      try {
        const upstream = await response.json() as { message?: string };
        if (typeof upstream.message === "string" && upstream.message.trim()) {
          upstreamMessage = upstream.message;
        }
      } catch {
        // Ignore response body parse errors and use default message.
      }

      if (response.status === 401) {
        return NextResponse.json(
          { error: "OpenWeather API key is invalid. Set OPENWEATHER_API_KEY in your environment variables." },
          { status: 502 },
        );
      }

      return NextResponse.json(
        { error: upstreamMessage },
        { status: 502 },
      );
    }

    const data = (await response.json()) as OpenWeatherResponse;
    const currentWeather = data.weather?.[0];

    const payload: WeatherPayload = {
      temp: typeof data.main?.temp === "number" ? data.main.temp : null,
      icon: currentWeather?.icon ?? null,
      condition: currentWeather?.main ?? currentWeather?.description ?? null,
      location: data.name ?? null,
    };

    weatherCache = {
      data: payload,
      expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
    };

    return NextResponse.json(payload);
  } catch {
    if (weatherCache?.data) {
      return NextResponse.json(weatherCache.data);
    }

    return NextResponse.json(
      { error: "Weather service is temporarily unavailable." },
      { status: 502 },
    );
  }
}
