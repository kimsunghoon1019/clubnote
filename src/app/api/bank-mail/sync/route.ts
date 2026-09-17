import { readSessionMemberId } from "@/lib/auth/requestSession";
import { isCronRequest, syncBankMailInbox } from "@/lib/bankMail";
import { remoteDbConfigured } from "@/lib/db/clubRepo";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function run(request: Request, apply: boolean) {
  const cron = isCronRequest(request);
  if (!cron && remoteDbConfigured()) {
    const memberId = await readSessionMemberId();
    if (!memberId) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const body = request.method === "POST" ? ((await request.json().catch(() => ({}))) as Record<string, unknown>) : {};
  const result = await syncBankMailInbox({
    address: typeof body.address === "string" ? body.address : undefined,
    appPassword: typeof body.appPassword === "string" ? body.appPassword : undefined,
    excelPassword: typeof body.excelPassword === "string" ? body.excelPassword : undefined,
    apply: apply || cron,
  });
  return NextResponse.json(result, { status: cron || result.ok || result.rows.length > 0 ? 200 : 400 });
}

export async function GET(request: Request) {
  return run(request, true);
}

export async function POST(request: Request) {
  return run(request, false);
}
