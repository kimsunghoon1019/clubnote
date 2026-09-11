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

export function WeatherMark({ day, className }: { day: WeatherDay; className?: string }) {
  const visual = weatherVisual(day.code);
  const Icon = ICONS[visual.icon];
  const temp = Number.isFinite(day.tmax) ? `${Math.round(day.tmax)}°` : "";
  const label = temp ? `${visual.label} ${temp}` : visual.label;
  return (
    <span
      data-weather={day.date}
      className={cn(
        "inline-flex shrink-0 flex-col items-center gap-px whitespace-nowrap lg:flex-row lg:items-center",
        className,
      )}
      title={`신촌 ${label}`}
      aria-label={`신촌 ${label}`}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0 lg:h-3 lg:w-3", visual.className)} strokeWidth={2.2} />
      {temp ? <span className="text-[9px] leading-none text-faint tabular-nums lg:text-[10px]">{temp}</span> : null}
    </span>
  );
}
