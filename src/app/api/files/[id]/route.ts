import { readSessionMemberId } from "@/lib/auth/requestSession";
import { remoteDbConfigured } from "@/lib/db/clubRepo";
import { hasR2, readR2File, removeR2File, writeR2File } from "@/lib/r2";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

const MAX_BYTES = 8 * 1024 * 1024;

async function requireMember() {
  if (!remoteDbConfigured()) {
    return { error: NextResponse.json({ error: "원격 DB가 설정되지 않았어요." }, { status: 503 }) };
  }
  if (!hasR2()) {
    return { error: NextResponse.json({ error: "Cloudflare R2가 설정되지 않았어요." }, { status: 503 }) };
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
  const row = await readR2File(id);
  if (!row) return NextResponse.json({ error: "파일이 없어요." }, { status: 404 });
  return new NextResponse(new Uint8Array(row.body), {
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
  try {
    await writeR2File(id, name, mime, buffer);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "파일을 올리지 못했어요.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (auth.error) return auth.error;
  const id = fileId(await context.params);
  if (id) await removeR2File(id);
  return NextResponse.json({ ok: true });
}
