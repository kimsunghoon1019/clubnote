import { applySessionCookie } from "@/lib/auth/requestSession";
import { seedPersisted } from "@/lib/clubState";
import { insertClubState, readClubState, remoteDbConfigured } from "@/lib/db/clubRepo";
import { authenticateMember } from "@/lib/session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!remoteDbConfigured()) {
    return NextResponse.json({ ok: false, error: "원격 DB가 설정되지 않았어요." }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { login?: string; pin?: string };
  const login = typeof body.login === "string" ? body.login : "";
  const pin = typeof body.pin === "string" ? body.pin : "";

  const existing = await readClubState();
  const members = existing?.payload.members ?? seedPersisted().members;
  const result = authenticateMember(members, login, pin);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
  }

  let bootstrapped = false;
  let version = existing?.version ?? 1;
  if (!existing) {
    const created = await insertClubState(seedPersisted());
    version = created.version;
    bootstrapped = true;
  }

  const response = NextResponse.json({
    ok: true,
    memberId: result.member.id,
    bootstrapped,
    version,
  });
  return applySessionCookie(response, result.member.id);
}
