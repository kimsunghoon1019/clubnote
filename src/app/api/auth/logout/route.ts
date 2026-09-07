import { clearSessionCookie } from "@/lib/auth/requestSession";
import { PREFERRED_REGION } from "@/lib/serverRegion";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = PREFERRED_REGION;

export async function POST() {
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
