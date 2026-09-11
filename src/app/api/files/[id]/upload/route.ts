import { readSessionMemberId } from "@/lib/auth/requestSession";
import { remoteDbConfigured } from "@/lib/db/clubRepo";
import { MAX_ATTACHMENT_BYTES } from "@/lib/fileLimits";
import {
  abortMultipartUpload,
  clearUploadTemp,
  completeMultipartUpload,
  createMultipartUpload,
  ensureR2Cors,
  hasR2,
  presignGet,
  presignPut,
  presignUploadPart,
  writeUploadSession,
} from "@/lib/r2";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

type Body = {
  action?: string;
  name?: string;
  mime?: string;
  download?: boolean;
  uploadId?: string;
  partNumber?: number;
  parts?: { partNumber: number; etag: string }[];
};

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

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (auth.error) return auth.error;
  const id = fileId(await context.params);
  if (!id) return NextResponse.json({ error: "파일이 없어요." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const action = body.action || "";
  const name = typeof body.name === "string" && body.name ? body.name : id;
  const mime = typeof body.mime === "string" && body.mime ? body.mime : "application/octet-stream";

  try {
    if (action === "sign-put" || action === "mp-init" || action === "mp-sign") {
      try {
        await ensureR2Cors();
      } catch {
        /* 토큰에 버킷 CORS 권한이 없을 수 있음. 수동 설정이 있으면 그대로 진행. */
      }
    }

    if (action === "sign-put") {
      const signed = await presignPut(id, name, mime);
      return NextResponse.json({ ok: true, ...signed, maxBytes: MAX_ATTACHMENT_BYTES });
    }

    if (action === "sign-get") {
      const signed = await presignGet(id, name, Boolean(body.download));
      return NextResponse.json({ ok: true, url: signed.url });
    }

    if (action === "mp-init" || action === "chunk-init") {
      const uploadId = await createMultipartUpload(id, name, mime);
      if (action === "chunk-init") {
        await writeUploadSession(id, { uploadId, name, mime, parts: [], pendingSize: 0 });
      }
      return NextResponse.json({ ok: true, uploadId });
    }

    if (action === "mp-sign") {
      const uploadId = String(body.uploadId || "");
      const partNumber = Number(body.partNumber);
      if (!uploadId || !Number.isInteger(partNumber) || partNumber < 1) {
        return NextResponse.json({ error: "업로드 정보가 없어요." }, { status: 400 });
      }
      const signed = await presignUploadPart(id, uploadId, partNumber);
      return NextResponse.json({ ok: true, url: signed.url });
    }

    if (action === "mp-complete") {
      const uploadId = String(body.uploadId || "");
      const parts = Array.isArray(body.parts) ? body.parts : [];
      if (!uploadId || parts.length === 0) {
        return NextResponse.json({ error: "업로드 정보가 없어요." }, { status: 400 });
      }
      await completeMultipartUpload(
        id,
        uploadId,
        parts.map((part) => ({
          partNumber: Number(part.partNumber),
          etag: String(part.etag || ""),
        })),
      );
      return NextResponse.json({ ok: true, id });
    }

    if (action === "mp-abort" || action === "chunk-abort") {
      const uploadId = String(body.uploadId || "");
      if (uploadId) await abortMultipartUpload(id, uploadId);
      await clearUploadTemp(id);
      return NextResponse.json({ ok: true });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "파일을 올리지 못했어요.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ error: "알 수 없는 요청이에요." }, { status: 400 });
}
