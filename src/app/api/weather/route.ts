import { clampWeatherPastDays, openMeteoForecastUrl, parseOpenMeteoDaily, SINCHON } from "@/lib/weather";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET(req: Request) {
  const pastDays = clampWeatherPastDays(new URL(req.url).searchParams.get("past"));
  try {
    const res = await fetch(openMeteoForecastUrl({ pastDays }), { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ place: SINCHON.name, days: [] });
    }
    const data = (await res.json()) as Parameters<typeof parseOpenMeteoDaily>[0];
    return NextResponse.json({ place: SINCHON.name, days: parseOpenMeteoDaily(data) });
  } catch {
    return NextResponse.json({ place: SINCHON.name, days: [] });
  }
}