import { openMeteoForecastUrl, parseOpenMeteoDaily, SINCHON } from "@/lib/weather";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(openMeteoForecastUrl(), { next: { revalidate: 1800 } });
    if (!res.ok) {
      return NextResponse.json({ place: SINCHON.name, days: [] });
    }
    const data = (await res.json()) as Parameters<typeof parseOpenMeteoDaily>[0];
    return NextResponse.json({ place: SINCHON.name, days: parseOpenMeteoDaily(data) });
  } catch {
    return NextResponse.json({ place: SINCHON.name, days: [] });
  }
}