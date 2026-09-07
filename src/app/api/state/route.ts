import { readSessionMemberId } from "@/lib/auth/requestSession";
import { asPersisted } from "@/lib/clubState";
import { readClubState, remoteDbConfigured, writeClubState } from "@/lib/db/clubRepo";
import { PREFERRED_REGION } from "@/lib/serverRegion";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = PREFERRED_REGION;

async function requireMember() {
  if (!remoteDbConfigured()) {
    return { error: NextResponse.json({ error: "원격 DB가 설정되지 않았어요." }, { status: 503 }) };
  }
  const memberId = await readSessionMemberId();
  if (!memberId) {
    return { error: NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 }) };
  }
  return { memberId };
}

export async function GET() {
  const auth = await requireMember();
  if (auth.error) return auth.error;
  const row = await readClubState();
  if (!row) return NextResponse.json({ payload: null, version: 0 }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(request: Request) {
  const auth = await requireMember();
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { payload?: unknown; version?: number };
  const payload = asPersisted(body.payload);
  if (!payload) {
    return NextResponse.json({ error: "저장 형식이 올바르지 않아요." }, { status: 400 });
  }
  const version = typeof body.version === "number" ? body.version : 0;
  const result = await writeClubState(payload, version);
  if ("conflict" in result) {
    return NextResponse.json(
      { conflict: true, payload: result.conflict.payload, version: result.conflict.version },
      { status: 409 },
    );
  }
  return NextResponse.json(result);
}
