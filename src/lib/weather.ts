export const SINCHON = {
  name: "신촌",
  latitude: 37.5598,
  longitude: 126.9369,
};

export type WeatherDay = {
  date: string;
  code: number;
  tmax: number;
};

export type WeatherIconKey = "sun" | "cloud-sun" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "thunder";

export function weatherVisual(code: number): { icon: WeatherIconKey; label: string; className: string } {
  if (code === 0) return { icon: "sun", label: "맑음", className: "text-warn" };
  if (code === 1) return { icon: "sun", label: "대체로 맑음", className: "text-warn" };
  if (code === 2) return { icon: "cloud-sun", label: "구름조금", className: "text-warn" };
  if (code === 3) return { icon: "cloud", label: "흐림", className: "text-faint" };
  if (code === 45 || code === 48) return { icon: "fog", label: "안개", className: "text-faint" };
  if (code >= 51 && code <= 57) return { icon: "drizzle", label: "이슬비", className: "text-brand-text" };
  if (code >= 71 && code <= 77) return { icon: "snow", label: "눈", className: "text-brand-text" };
  if (code >= 85 && code <= 86) return { icon: "snow", label: "눈", className: "text-brand-text" };
  if (code >= 95) return { icon: "thunder", label: "뇌우", className: "text-up" };
  if (code >= 80 && code <= 82) return { icon: "rain", label: "소나기", className: "text-brand-text" };
  return { icon: "rain", label: "비", className: "text-brand-text" };
}

export function parseOpenMeteoDaily(data: {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
  };
}): WeatherDay[] {
  const time = data.daily?.time ?? [];
  const codes = data.daily?.weather_code ?? [];
  const tmax = data.daily?.temperature_2m_max ?? [];
  return time
    .map((date, i) => ({
      date,
      code: Number(codes[i] ?? 0),
      tmax: Number(tmax[i] ?? 0),
    }))
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date));
}

export function openMeteoForecastUrl() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(SINCHON.latitude));
  url.searchParams.set("longitude", String(SINCHON.longitude));
  url.searchParams.set("daily", "weather_code,temperature_2m_max");
  url.searchParams.set("timezone", "Asia/Seoul");
  url.searchParams.set("forecast_days", "16");
  return url.toString();
}