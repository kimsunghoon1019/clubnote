import { readSessionMemberId } from "@/lib/auth/requestSession";
import { remoteDbConfigured } from "@/lib/db/clubRepo";
import { FILE_ASSEMBLE_PART_BYTES, FILE_CHUNK_BYTES, MAX_ATTACHMENT_BYTES } from "@/lib/fileLimits";
import {
  clearUploadTemp,
  completeMultipartUpload,
  hasR2,
  readR2Key,
  readUploadSession,
  removeR2Key,
  uploadPartBuffer,
  uploadPendingKey,
  writeR2Key,
  writeUploadSession,
} from "@/lib/r2";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";
export const maxDuration = 60;

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

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (auth.error) return auth.error;
  const id = fileId(await context.params);
  if (!id) return NextResponse.json({ error: "파일이 없어요." }, { status: 400 });

  const last = new URL(request.url).searchParams.get("last") === "1";
  const chunk = Buffer.from(await request.arrayBuffer());
  if (chunk.byteLength === 0) return NextResponse.json({ error: "빈 조각이에요." }, { status: 400 });
  if (chunk.byteLength > FILE_CHUNK_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "조각이 너무 커요." }, { status: 413 });
  }

  const session = await readUploadSession(id);
  if (!session) return NextResponse.json({ error: "업로드를 시작하지 않았어요." }, { status: 400 });

  let pending = Buffer.alloc(0);
  if (session.pendingSize > 0) {
    const stored = await readR2Key(uploadPendingKey(id));
    if (stored) pending = stored;
  }
  const combined = Buffer.concat([pending, chunk]);
  if (combined.byteLength > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "파일은 5GB 이하만 올릴 수 있어요." }, { status: 413 });
  }

  const parts = [...session.parts];
  let leftover = combined;
  try {
    if (!last) {
      while (leftover.byteLength >= FILE_ASSEMBLE_PART_BYTES) {
        const part = leftover.subarray(0, FILE_ASSEMBLE_PART_BYTES);
        leftover = leftover.subarray(FILE_ASSEMBLE_PART_BYTES);
        const etag = await uploadPartBuffer(id, session.uploadId, parts.length + 1, part);
        parts.push({ partNumber: parts.length + 1, etag });
      }
      if (leftover.byteLength) {
        await writeR2Key(uploadPendingKey(id), "application/octet-stream", leftover);
      } else {
        await removeR2Key(uploadPendingKey(id));
      }
      await writeUploadSession(id, { ...session, parts, pendingSize: leftover.byteLength });
      return NextResponse.json({ ok: true, received: true });
    }

    if (leftover.byteLength) {
      const etag = await uploadPartBuffer(id, session.uploadId, parts.length + 1, leftover);
      parts.push({ partNumber: parts.length + 1, etag });
    }
    if (parts.length === 0) {
      return NextResponse.json({ error: "올릴 내용이 없어요." }, { status: 400 });
    }
    await completeMultipartUpload(id, session.uploadId, parts);
    await clearUploadTemp(id);
    return NextResponse.json({ ok: true, id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "파일을 올리지 못했어요.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
