import type { Persisted } from "./clubState";
import {
  FILE_CHUNK_BYTES,
  FILE_PART_SIZE,
  FILE_PROXY_MAX_BYTES,
  FILE_SINGLE_PUT_MAX_BYTES,
  MAX_ATTACHMENT_BYTES,
} from "./fileLimits";

export type DbHealth = { remote: boolean; ready: boolean; error?: string; files?: boolean; filesError?: string };

let healthCache: DbHealth | null = null;

export async function fetchDbHealth(force = false): Promise<DbHealth> {
  if (!force && healthCache) return healthCache;
  try {
    const res = await fetch("/api/db/health", { cache: "no-store" });
    const data = (await res.json()) as DbHealth;
    healthCache = {
      remote: Boolean(data.remote),
      ready: Boolean(data.ready),
      files: Boolean(data.files),
      error: typeof data.error === "string" ? data.error : undefined,
      filesError: typeof data.filesError === "string" ? data.filesError : undefined,
    };
  } catch {
    healthCache = { remote: false, ready: false };
  }
  return healthCache;
}

export function cachedDbHealth() {
  return healthCache;
}

export async function fetchAuthSession() {
  const res = await fetch("/api/auth/session", { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { memberId?: string };
  return typeof data.memberId === "string" && data.memberId ? { memberId: data.memberId } : null;
}

export async function loginRemote(login: string, pin: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login, pin }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    memberId?: string;
    bootstrapped?: boolean;
    version?: number;
  };
  if (!res.ok || !data.ok || !data.memberId) {
    return { ok: false as const, error: data.error || "로그인에 실패했어요." };
  }
  return {
    ok: true as const,
    memberId: data.memberId,
    bootstrapped: Boolean(data.bootstrapped),
    version: Number(data.version) || 1,
  };
}

export async function logoutRemote() {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function fetchClubState(): Promise<{ payload: Persisted; version: number } | null> {
  const res = await fetch("/api/state", { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { payload?: unknown; version?: number };
  if (!data || typeof data !== "object") return null;
  return { payload: data.payload as Persisted, version: Number(data.version) || 1 };
}

export async function putClubState(payload: Persisted, version: number) {
  const res = await fetch("/api/state", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload, version }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    payload?: Persisted;
    version?: number;
    conflict?: boolean;
    error?: string;
  };
  if (res.status === 409 && data.payload) {
    return { ok: false as const, conflict: true as const, payload: data.payload, version: Number(data.version) || version };
  }
  if (!res.ok) {
    return { ok: false as const, conflict: false as const, error: data.error || "저장에 실패했어요." };
  }
  return { ok: true as const, payload: (data.payload ?? payload) as Persisted, version: Number(data.version) || version + 1 };
}

type ProgressFn = (ratio: number) => void;

function fileApi(id: string, suffix = "") {
  return `/api/files/${encodeURIComponent(id)}${suffix}`;
}

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return typeof data.error === "string" && data.error ? data.error : fallback;
}

async function uploadAction(id: string, body: Record<string, unknown>) {
  const res = await fetch(fileApi(id, "/upload"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    url?: string;
    headers?: Record<string, string>;
    uploadId?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(typeof data.error === "string" && data.error ? data.error : "파일을 서버에 올리지 못했어요");
  }
  return data;
}

function putToUrl(url: string, blob: Blob, headers: Record<string, string>, onProgress?: ProgressFn) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [key, value] of Object.entries(headers)) {
      if (value) xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve(xhr.getResponseHeader("etag") || xhr.getResponseHeader("ETag") || "");
      } else {
        reject(new Error("파일을 올리지 못했어요"));
      }
    };
    xhr.onerror = () => reject(new Error("큰 파일은 R2 버킷 CORS가 필요해요. README의 CORS 설정을 확인해 주세요."));
    xhr.send(blob);
  });
}

async function putViaProxy(id: string, blob: Blob, name: string, mime: string) {
  const res = await fetch(fileApi(id), {
    method: "PUT",
    headers: {
      "content-type": mime || blob.type || "application/octet-stream",
      "x-file-name": encodeURIComponent(name || id),
    },
    body: blob,
  });
  if (!res.ok) {
    const message = await readError(res, "");
    if (res.status === 413) throw new Error("파일이 너무 커서 올리지 못했어요");
    throw new Error(message || "파일을 서버에 올리지 못했어요");
  }
}

async function putViaSigned(id: string, blob: Blob, name: string, mime: string, onProgress?: ProgressFn) {
  const signed = await uploadAction(id, { action: "sign-put", name, mime });
  if (!signed.url) throw new Error("업로드 주소를 받지 못했어요");
  await putToUrl(signed.url, blob, signed.headers ?? {}, onProgress);
}

async function putViaChunks(id: string, blob: Blob, name: string, mime: string, onProgress?: ProgressFn) {
  const started = await uploadAction(id, { action: "chunk-init", name, mime });
  const uploadId = started.uploadId;
  const total = blob.size;
  let uploaded = 0;
  try {
    const count = Math.max(1, Math.ceil(total / FILE_CHUNK_BYTES));
    for (let i = 0; i < count; i += 1) {
      const start = i * FILE_CHUNK_BYTES;
      const chunk = blob.slice(start, Math.min(start + FILE_CHUNK_BYTES, total));
      const last = i === count - 1;
      const res = await fetch(fileApi(id, `/chunk?last=${last ? "1" : "0"}`), {
        method: "PUT",
        body: chunk,
      });
      if (!res.ok) throw new Error(await readError(res, "파일을 올리지 못했어요"));
      uploaded += chunk.size;
      onProgress?.(total ? uploaded / total : 1);
    }
  } catch (error) {
    try {
      await uploadAction(id, { action: "chunk-abort", uploadId });
    } catch {
      /* still throw the original */
    }
    throw error;
  }
}

async function putViaMultipart(id: string, blob: Blob, name: string, mime: string, onProgress?: ProgressFn) {
  const started = await uploadAction(id, { action: "mp-init", name, mime });
  const uploadId = started.uploadId;
  if (!uploadId) throw new Error("업로드를 시작하지 못했어요");
  const parts: { partNumber: number; etag: string }[] = [];
  const total = blob.size;
  let uploaded = 0;
  try {
    let partNumber = 1;
    for (let start = 0; start < total; start += FILE_PART_SIZE, partNumber += 1) {
      const chunk = blob.slice(start, Math.min(start + FILE_PART_SIZE, total));
      const signed = await uploadAction(id, { action: "mp-sign", uploadId, partNumber });
      if (!signed.url) throw new Error("업로드 주소를 받지 못했어요");
      const etag = await putToUrl(signed.url, chunk, {}, (ratio) => {
        onProgress?.(total ? (uploaded + chunk.size * ratio) / total : 1);
      });
      if (!etag) throw new Error("업로드 응답이 없어요");
      parts.push({ partNumber, etag });
      uploaded += chunk.size;
      onProgress?.(total ? uploaded / total : 1);
    }
    await uploadAction(id, { action: "mp-complete", uploadId, parts });
  } catch (error) {
    try {
      await uploadAction(id, { action: "mp-abort", uploadId });
    } catch {
      /* still throw the original */
    }
    throw error;
  }
}

export async function putClubFile(
  id: string,
  blob: Blob,
  name: string,
  mime: string,
  onProgress?: ProgressFn,
) {
  if (blob.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("파일은 5GB 이하만 올릴 수 있어요");
  }
  const localHost = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  if (blob.size <= FILE_PROXY_MAX_BYTES || (localHost && blob.size <= FILE_PROXY_MAX_BYTES * 8)) {
    await putViaProxy(id, blob, name, mime);
    onProgress?.(1);
    return;
  }
  try {
    if (blob.size <= FILE_SINGLE_PUT_MAX_BYTES) {
      await putViaSigned(id, blob, name, mime, onProgress);
      return;
    }
    await putViaMultipart(id, blob, name, mime, onProgress);
  } catch {
    await putViaChunks(id, blob, name, mime, onProgress);
  }
}

export async function getClubFile(id: string, opts?: { maxBytes?: number }): Promise<Blob | undefined> {
  if (opts?.maxBytes != null) {
    const head = await fetch(fileApi(id), { method: "HEAD", cache: "no-store" });
    if (!head.ok) return undefined;
    const length = Number(head.headers.get("content-length") || 0);
    if (length > opts.maxBytes) return undefined;
  }
  const res = await fetch(fileApi(id), { cache: "no-store" });
  if (!res.ok) return undefined;
  const mime = res.headers.get("content-type") || "application/octet-stream";
  return new Blob([await res.arrayBuffer()], { type: mime });
}

export function clubFileHref(id: string, download = false) {
  return download ? `${fileApi(id)}?download=1` : fileApi(id);
}

export async function clubFileSignedGet(id: string, name: string, download = false) {
  const signed = await uploadAction(id, { action: "sign-get", name, download });
  return signed.url || clubFileHref(id, download);
}

export async function deleteClubFile(id: string) {
  await fetch(fileApi(id), { method: "DELETE" });
}
