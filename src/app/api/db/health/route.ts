import { pingClubDb, remoteDbConfigured } from "@/lib/db/clubRepo";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  if (!remoteDbConfigured()) {
    return NextResponse.json({ remote: false, ready: false });
  }
  const ping = await pingClubDb();
  return NextResponse.json(ping);
}
