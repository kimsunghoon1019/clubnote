export const SINCHON = {
  name: "신촌",
  latitude: 37.5598,
  longitude: 126.9369,
};

export const WEATHER_PAST_DAYS = 92;
const SEOUL = "Asia/Seoul";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
    .filter((day) => ISO_DATE.test(day.date));
}

export function openMeteoForecastUrl(opts?: { pastDays?: number }) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(SINCHON.latitude));
  url.searchParams.set("longitude", String(SINCHON.longitude));
  url.searchParams.set("daily", "weather_code,temperature_2m_max");
  url.searchParams.set("timezone", SEOUL);
  url.searchParams.set("forecast_days", "16");
  const past = Math.min(WEATHER_PAST_DAYS, Math.max(0, Math.floor(opts?.pastDays ?? 0)));
  if (past > 0) url.searchParams.set("past_days", String(past));
  return url.toString();
}

export function clampWeatherPastDays(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(WEATHER_PAST_DAYS, Math.max(0, Math.floor(n)));
}

export function normalizeWeatherDays(raw: unknown): WeatherDay[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, WeatherDay>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<WeatherDay>;
    const date = String(row.date ?? "");
    if (!ISO_DATE.test(date)) continue;
    map.set(date, { date, code: Number(row.code ?? 0), tmax: Number(row.tmax ?? 0) });
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeWeatherDays(stored: WeatherDay[], incoming: WeatherDay[], today: string): WeatherDay[] {
  const map = new Map<string, WeatherDay>();
  for (const day of normalizeWeatherDays(stored)) map.set(day.date, day);
  for (const day of normalizeWeatherDays(incoming)) {
    const existing = map.get(day.date);
    if (existing && day.date < today) continue;
    map.set(day.date, day);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function seoulISODate(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: SEOUL });
}

function addCalendarDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function sixAMSeoul(iso: string) {
  return new Date(`${iso}T06:00:00+09:00`);
}

export function lastSixAMSeoul(now = new Date()) {
  const today = seoulISODate(now);
  const todaySix = sixAMSeoul(today);
  if (now.getTime() >= todaySix.getTime()) return todaySix;
  return sixAMSeoul(addCalendarDays(today, -1));
}

export function nextSixAMSeoul(now = new Date()) {
  const today = seoulISODate(now);
  const todaySix = sixAMSeoul(today);
  if (now.getTime() < todaySix.getTime()) return todaySix;
  return sixAMSeoul(addCalendarDays(today, 1));
}

export function needsMorningWeatherFetch(fetchedAt: string | null | undefined, now = new Date()) {
  if (!fetchedAt) return true;
  const t = Date.parse(fetchedAt);
  if (!Number.isFinite(t)) return true;
  return t < lastSixAMSeoul(now).getTime();
}

export async function loadSinchonWeather(signal: AbortSignal, pastDays = 0): Promise<WeatherDay[]> {
  const past = clampWeatherPastDays(pastDays);
  try {
    const res = await fetch(`/api/weather?past=${past}`, { signal, cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { days?: WeatherDay[] };
      const days = normalizeWeatherDays(data.days);
      if (days.length > 0) return days;
    }
  } catch {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  }
  try {
    const res = await fetch(openMeteoForecastUrl({ pastDays: past }), { signal, cache: "no-store" });
    if (!res.ok) return [];
    return parseOpenMeteoDaily(await res.json());
  } catch {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    return [];
  }
}
