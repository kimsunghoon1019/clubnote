import { readSessionMemberId } from "@/lib/auth/requestSession";
import { remoteDbConfigured } from "@/lib/db/clubRepo";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET() {
  if (!remoteDbConfigured()) {
    return NextResponse.json({ memberId: null, remote: false });
  }
  const memberId = await readSessionMemberId();
  return NextResponse.json({ memberId, remote: true });
}
