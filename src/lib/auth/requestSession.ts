import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { decodeSession, encodeSession, SESSION_COOKIE, SESSION_MAX_AGE, sessionSecret } from "./sessionToken";

export async function readSessionMemberId(request?: NextRequest) {
  const token = request
    ? request.cookies.get(SESSION_COOKIE)?.value
    : (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await decodeSession(token, sessionSecret());
  return session?.memberId ?? null;
}

export async function applySessionCookie(response: NextResponse, memberId: string) {
  const token = await encodeSession(memberId, sessionSecret());
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
