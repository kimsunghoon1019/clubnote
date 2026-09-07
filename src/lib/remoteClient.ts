import type { Persisted } from "./clubState";

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

export async function putClubFile(id: string, blob: Blob, name: string, mime: string) {
  const res = await fetch(`/api/files/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "content-type": mime || blob.type || "application/octet-stream",
      "x-file-name": encodeURIComponent(name || id),
    },
    body: blob,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    const message = typeof data.error === "string" && data.error ? data.error : "";
    if (res.status === 413) throw new Error("파일이 너무 커서 올리지 못했어요");
    throw new Error(message || "파일을 서버에 올리지 못했어요");
  }
}

export async function getClubFile(id: string): Promise<Blob | undefined> {
  const res = await fetch(`/api/files/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) return undefined;
  const mime = res.headers.get("content-type") || "application/octet-stream";
  return new Blob([await res.arrayBuffer()], { type: mime });
}

export async function deleteClubFile(id: string) {
  await fetch(`/api/files/${encodeURIComponent(id)}`, { method: "DELETE" });
}
