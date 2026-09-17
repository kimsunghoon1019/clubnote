import { readSessionMemberId } from "@/lib/auth/requestSession";
import { loadBankMailSecrets, publicBankMailSettings, saveBankMailSecrets } from "@/lib/bankMail";
import { remoteDbConfigured } from "@/lib/db/clubRepo";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

async function requireMember() {
  if (!remoteDbConfigured()) return {};
  const memberId = await readSessionMemberId();
  if (!memberId) return { error: NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 }) };
  return { memberId };
}

export async function GET() {
  const auth = await requireMember();
  if (auth.error) return auth.error;
  const { secrets, storedOnServer } = await loadBankMailSecrets();
  return NextResponse.json(publicBankMailSettings(secrets, storedOnServer));
}

export async function PUT(request: Request) {
  const auth = await requireMember();
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => ({}))) as {
    address?: unknown;
    appPassword?: unknown;
    excelPassword?: unknown;
  };
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const appPassword = typeof body.appPassword === "string" ? body.appPassword : undefined;
  const excelPassword = typeof body.excelPassword === "string" ? body.excelPassword : undefined;
  try {
    const saved = await saveBankMailSecrets({
      ...(address ? { address } : {}),
      ...(appPassword !== undefined && appPassword !== "" ? { appPassword } : {}),
      ...(excelPassword !== undefined && excelPassword !== "" ? { excelPassword } : {}),
      lastError: "",
    });
    return NextResponse.json(publicBankMailSettings(saved.secrets, saved.storedOnServer));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "설정을 저장하지 못했어요" },
      { status: 500 },
    );
  }
}
