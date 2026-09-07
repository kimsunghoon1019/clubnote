import { readSessionMemberId } from "@/lib/auth/requestSession";
import { readClubFile, remoteDbConfigured, removeClubFile, writeClubFile } from "@/lib/db/clubRepo";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

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

function fileId(params: { id: string }) {
  return decodeURIComponent(params.id || "").trim();
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (auth.error) return auth.error;
  const id = fileId(await context.params);
  if (!id) return NextResponse.json({ error: "파일이 없어요." }, { status: 400 });
  const row = await readClubFile(id);
  if (!row) return NextResponse.json({ error: "파일이 없어요." }, { status: 404 });
  const bytes = Buffer.from(row.content, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": row.mime || "application/octet-stream",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.name || id)}`,
      "cache-control": "private, max-age=3600",
    },
  });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (auth.error) return auth.error;
  const id = fileId(await context.params);
  if (!id) return NextResponse.json({ error: "파일이 없어요." }, { status: 400 });
  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "파일은 8MB 이하만 올릴 수 있어요." }, { status: 413 });
  }
  const mime = request.headers.get("content-type") || "application/octet-stream";
  const rawName = request.headers.get("x-file-name") || id;
  let name = id;
  try {
    name = decodeURIComponent(rawName);
  } catch {
    name = rawName;
  }
  await writeClubFile(id, name, mime, buffer.toString("base64"));
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (auth.error) return auth.error;
  const id = fileId(await context.params);
  if (id) await removeClubFile(id);
  return NextResponse.json({ ok: true });
}
