import { pingClubDb, remoteDbConfigured } from "@/lib/db/clubRepo";
import { pingR2 } from "@/lib/r2";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET() {
  if (!remoteDbConfigured()) {
    return NextResponse.json({ remote: false, ready: false, files: false });
  }
  const ping = await pingClubDb();
  const files = await pingR2();
  return NextResponse.json({
    ...ping,
    files: files.ready,
    filesError: files.error,
  });
}
