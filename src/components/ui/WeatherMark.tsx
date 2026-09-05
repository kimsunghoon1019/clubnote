"use client";

import { cn } from "@/lib/cn";
import { weatherVisual, type WeatherDay, type WeatherIconKey } from "@/lib/weather";
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