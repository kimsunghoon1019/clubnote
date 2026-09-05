"use client";

import { cn } from "@/lib/cn";
import { openMeteoForecastUrl, parseOpenMeteoDaily, weatherVisual, type WeatherDay, type WeatherIconKey } from "@/lib/weather";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";

const ICONS: Record<WeatherIconKey, typeof Sun> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  thunder: CloudLightning,
};

async function loadForecast(signal: AbortSignal): Promise<WeatherDay[]> {
  try {
    const res = await fetch("/api/weather", { signal });
    if (res.ok) {
      const data = (await res.json()) as { days?: WeatherDay[] };
      if (Array.isArray(data.days) && data.days.length > 0) return data.days;
    }
  } catch {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  }
  const res = await fetch(openMeteoForecastUrl(), { signal });
  if (!res.ok) return [];
  return parseOpenMeteoDaily(await res.json());
}

export function useSinchonForecast() {
  const [days, setDays] = useState<Map<string, WeatherDay>>(new Map());
  useEffect(() => {
    const ac = new AbortController();
    loadForecast(ac.signal)
      .then((list) => {
        const map = new Map<string, WeatherDay>();
        for (const day of list) map.set(day.date, day);
        setDays(map);
      })
      .catch(() => {
        setDays(new Map());
      });
    return () => ac.abort();
  }, []);
  return days;
}

export function WeatherMark({ day }: { day: WeatherDay }) {
  const visual = weatherVisual(day.code);
  const Icon = ICONS[visual.icon];
  const temp = Number.isFinite(day.tmax) ? `${Math.round(day.tmax)}°` : "";
  const label = temp ? `${visual.label} ${temp}` : visual.label;
  return (
    <span
      data-weather={day.date}
      className="inline-flex shrink-0 items-center gap-px whitespace-nowrap"
      title={`신촌 ${label}`}
      aria-label={`신촌 ${label}`}
    >
      <Icon className={cn("h-3 w-3 shrink-0", visual.className)} strokeWidth={2.2} />
      {temp ? <span className="text-[10px] leading-none text-faint tabular-nums">{temp}</span> : null}
    </span>
  );
}