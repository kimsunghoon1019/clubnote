import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

export async function GET(request: Request) {
  const next = new URL(request.url).searchParams.get("next") ?? "/";
  return NextResponse.redirect(new URL(next, request.url));
}
