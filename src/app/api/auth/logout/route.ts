import { clearSessionCookie } from "@/lib/auth/requestSession";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function POST() {
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
