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

async function r2Error(res: Response, fallback: string) {
  const text = (await res.text().catch(() => "")).replace(/\s+/g, " ").trim();
  const message = text.match(/<Message>([^<]+)<\/Message>/)?.[1]?.trim();
  return message || text.slice(0, 240) || fallback;
}

async function signedR2Fetch(url: string, init: { method: string; headers?: Record<string, string>; body?: Uint8Array }) {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (init.body) headers["content-length"] = String(init.body.byteLength);
  const signed = await r2Client().sign(url, {
    method: init.method,
    headers,
    body: init.body,
  });
  const out = new Headers(signed.headers);
  if (init.body) out.set("content-length", String(init.body.byteLength));
  return fetch(url, {
    method: init.method,
    headers: out,
    body: init.body,
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
