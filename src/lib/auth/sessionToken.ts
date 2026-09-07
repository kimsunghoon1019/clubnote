export const SESSION_COOKIE = "clubnote_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type SessionPayload = { memberId: string; exp: number };

const encoder = new TextEncoder();

export function sessionSecret() {
  return process.env.CLUB_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "clubnote-dev-secret";
}

function bytesToB64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "==".slice((value.length * 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function textToB64Url(value: string) {
  return bytesToB64Url(encoder.encode(value));
}

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return bytesToB64Url(new Uint8Array(signature));
}

export async function encodeSession(memberId: string, secret = sessionSecret()) {
  const payload: SessionPayload = {
    memberId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const body = textToB64Url(JSON.stringify(payload));
  const signature = await hmac(secret, body);
  return `${body}.${signature}`;
}

export async function decodeSession(token: string, secret = sessionSecret()): Promise<SessionPayload | null> {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = await hmac(secret, body);
  if (expected.length !== signature.length) return null;
  let different = 0;
  for (let i = 0; i < expected.length; i += 1) {
    different |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (different !== 0) return null;
  try {
    const json = new TextDecoder().decode(b64UrlToBytes(body));
    const data = JSON.parse(json) as Partial<SessionPayload>;
    if (typeof data.memberId !== "string" || !data.memberId) return null;
    if (typeof data.exp !== "number" || data.exp < Math.floor(Date.now() / 1000)) return null;
    return { memberId: data.memberId, exp: data.exp };
  } catch {
    return null;
  }
}
