import { AwsClient } from "aws4fetch";

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export function hasR2() {
  return Boolean(env("R2_ACCOUNT_ID") && env("R2_ACCESS_KEY_ID") && env("R2_SECRET_ACCESS_KEY") && env("R2_BUCKET"));
}

function r2Client() {
  return new AwsClient({
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
}

function bucketUrl() {
  const endpoint = env("R2_ENDPOINT") || `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`;
  return `${endpoint.replace(/\/$/, "")}/${env("R2_BUCKET")}`;
}

function objectUrl(id: string) {
  return `${bucketUrl()}/files/${encodeURIComponent(id)}`;
}

function keyUrl(key: string) {
  return `${bucketUrl()}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function uploadSessionKey(id: string) {
  return `uploads/${id}/session.json`;
}

export function uploadPendingKey(id: string) {
  return `uploads/${id}/pending.bin`;
}

async function r2Error(res: Response, fallback: string) {
  const text = (await res.text().catch(() => "")).replace(/\s+/g, " ").trim();
  const message = text.match(/<Message>([^<]+)<\/Message>/)?.[1]?.trim();
  return message || text.slice(0, 240) || fallback;
}

function toArrayBuffer(body: Uint8Array) {
  const copy = new Uint8Array(body.byteLength);
  copy.set(body);
  return copy.buffer;
}

async function signedR2Fetch(url: string, init: { method: string; headers?: Record<string, string>; body?: Uint8Array }) {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  const payload = init.body
    ? new Blob([toArrayBuffer(init.body)], { type: headers["content-type"] || "application/octet-stream" })
    : undefined;
  if (payload) headers["content-length"] = String(payload.size);
  const signed = await r2Client().sign(url, {
    method: init.method,
    headers,
    body: payload,
  });
  const out = new Headers(signed.headers);
  if (payload) out.set("content-length", String(payload.size));
  return fetch(url, {
    method: init.method,
    headers: out,
    body: payload,
  });
}

export async function pingR2() {
  if (!hasR2()) return { configured: false as const, ready: false as const, error: "R2 환경변수가 없어요." };
  try {
    const res = await r2Client().fetch(`${bucketUrl()}?list-type=2&max-keys=1`, { method: "GET" });
    if (!res.ok) {
      return { configured: true as const, ready: false as const, error: await r2Error(res, `R2 ${res.status}`) };
    }
    return { configured: true as const, ready: true as const };
  } catch (err) {
    return {
      configured: true as const,
      ready: false as const,
      error: err instanceof Error ? err.message : "R2에 연결하지 못했어요.",
    };
  }
}

export async function readR2File(id: string) {
  const res = await r2Client().fetch(objectUrl(id), { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await r2Error(res, "파일을 읽지 못했어요."));
  const rawName = res.headers.get("x-amz-meta-name") || id;
  let name = id;
  try {
    name = decodeURIComponent(rawName);
  } catch {
    name = rawName;
  }
  return {
    id,
    name,
    mime: res.headers.get("content-type") || "application/octet-stream",
    body: Buffer.from(await res.arrayBuffer()),
  };
}

export async function writeR2File(id: string, name: string, mime: string, body: Buffer) {
  const bytes = new Uint8Array(body);
  const res = await signedR2Fetch(objectUrl(id), {
    method: "PUT",
    headers: {
      "content-type": mime || "application/octet-stream",
      "x-amz-meta-name": encodeURIComponent(name || id),
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(await r2Error(res, "파일을 올리지 못했어요."));
}

export async function removeR2File(id: string) {
  const res = await r2Client().fetch(objectUrl(id), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(await r2Error(res, "파일을 지우지 못했어요."));
}

export async function openR2File(id: string) {
  return r2Client().fetch(objectUrl(id), { method: "GET" });
}

function metaName(res: Response, id: string) {
  const rawName = res.headers.get("x-amz-meta-name") || id;
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

export async function headR2File(id: string) {
  const res = await r2Client().fetch(objectUrl(id), { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await r2Error(res, "파일을 읽지 못했어요."));
  return {
    id,
    name: metaName(res, id),
    mime: res.headers.get("content-type") || "application/octet-stream",
    bytes: Number(res.headers.get("content-length") || 0),
  };
}

function requiredPutHeaders(name: string, mime: string) {
  return {
    "content-type": mime || "application/octet-stream",
    "x-amz-meta-name": encodeURIComponent(name || "file"),
  };
}

async function presign(url: string, method: string, headers: Record<string, string>, expiresSec: number) {
  const target = new URL(url);
  target.searchParams.set("X-Amz-Expires", String(expiresSec));
  const signed = await r2Client().sign(target.toString(), {
    method,
    headers,
    aws: { signQuery: true },
  });
  return { url: signed.url.toString(), headers };
}

export async function presignPut(id: string, name: string, mime: string, expiresSec = 900) {
  const headers = requiredPutHeaders(name, mime);
  return presign(objectUrl(id), "PUT", headers, expiresSec);
}

export async function presignGet(id: string, name: string, download = false, expiresSec = 600) {
  const url = new URL(objectUrl(id));
  const filename = `filename*=UTF-8''${encodeURIComponent(name || id)}`;
  url.searchParams.set("response-content-disposition", `${download ? "attachment" : "inline"}; ${filename}`);
  return presign(url.toString(), "GET", {}, expiresSec);
}

export async function createMultipartUpload(id: string, name: string, mime: string) {
  const res = await signedR2Fetch(`${objectUrl(id)}?uploads`, {
    method: "POST",
    headers: requiredPutHeaders(name, mime),
  });
  if (!res.ok) throw new Error(await r2Error(res, "업로드를 시작하지 못했어요."));
  const xml = await res.text();
  const uploadId = xml.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1]?.trim();
  if (!uploadId) throw new Error("업로드를 시작하지 못했어요.");
  return uploadId;
}

export async function presignUploadPart(id: string, uploadId: string, partNumber: number, expiresSec = 900) {
  const url = new URL(objectUrl(id));
  url.searchParams.set("partNumber", String(partNumber));
  url.searchParams.set("uploadId", uploadId);
  return presign(url.toString(), "PUT", {}, expiresSec);
}

export async function completeMultipartUpload(
  id: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
) {
  const body = [
    "<CompleteMultipartUpload>",
    ...parts.map((part) => {
      const etag = part.etag.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      return `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${etag}</ETag></Part>`;
    }),
    "</CompleteMultipartUpload>",
  ].join("");
  const bytes = new TextEncoder().encode(body);
  const url = new URL(objectUrl(id));
  url.searchParams.set("uploadId", uploadId);
  const res = await signedR2Fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/xml" },
    body: bytes,
  });
  if (!res.ok) throw new Error(await r2Error(res, "업로드를 끝내지 못했어요."));
}

export async function abortMultipartUpload(id: string, uploadId: string) {
  const url = new URL(objectUrl(id));
  url.searchParams.set("uploadId", uploadId);
  const res = await r2Client().fetch(url.toString(), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(await r2Error(res, "업로드를 취소하지 못했어요."));
}

const CORS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <AllowedHeader>content-type</AllowedHeader>
    <AllowedHeader>x-amz-meta-name</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>etag</ExposeHeader>
    <MaxAgeSeconds>86400</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`;

let corsReady: Promise<void> | null = null;

export async function ensureR2Cors() {
  if (!corsReady) {
    corsReady = (async () => {
      const bytes = new TextEncoder().encode(CORS_XML);
      const res = await signedR2Fetch(`${bucketUrl()}?cors`, {
        method: "PUT",
        headers: { "content-type": "application/xml" },
        body: bytes,
      });
      if (!res.ok) {
        corsReady = null;
        throw new Error(await r2Error(res, "R2 CORS를 설정하지 못했어요."));
      }
    })();
  }
  return corsReady;
}

export type UploadSession = {
  uploadId: string;
  name: string;
  mime: string;
  parts: { partNumber: number; etag: string }[];
  pendingSize: number;
};

export async function writeR2Key(key: string, mime: string, body: Uint8Array) {
  const res = await signedR2Fetch(keyUrl(key), {
    method: "PUT",
    headers: { "content-type": mime || "application/octet-stream" },
    body,
  });
  if (!res.ok) throw new Error(await r2Error(res, "파일을 올리지 못했어요."));
}

export async function readR2Key(key: string) {
  const res = await r2Client().fetch(keyUrl(key), { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await r2Error(res, "파일을 읽지 못했어요."));
  return Buffer.from(await res.arrayBuffer());
}

export async function removeR2Key(key: string) {
  const res = await r2Client().fetch(keyUrl(key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(await r2Error(res, "파일을 지우지 못했어요."));
}

export async function uploadPartBuffer(id: string, uploadId: string, partNumber: number, body: Uint8Array) {
  const url = new URL(objectUrl(id));
  url.searchParams.set("partNumber", String(partNumber));
  url.searchParams.set("uploadId", uploadId);
  const res = await signedR2Fetch(url.toString(), { method: "PUT", body });
  if (!res.ok) throw new Error(await r2Error(res, "파일을 올리지 못했어요."));
  const etag = res.headers.get("etag") || res.headers.get("ETag") || "";
  if (!etag) throw new Error("업로드 응답이 없어요.");
  return etag;
}

export async function readUploadSession(id: string): Promise<UploadSession | null> {
  const raw = await readR2Key(uploadSessionKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw.toString("utf8")) as UploadSession;
  } catch {
    return null;
  }
}

export async function writeUploadSession(id: string, session: UploadSession) {
  const bytes = new TextEncoder().encode(JSON.stringify(session));
  await writeR2Key(uploadSessionKey(id), "application/json", bytes);
}

export async function clearUploadTemp(id: string) {
  await Promise.all([removeR2Key(uploadSessionKey(id)), removeR2Key(uploadPendingKey(id))]);
}
