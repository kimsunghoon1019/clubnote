import { decodeSession, SESSION_COOKIE, sessionSecret } from "@/lib/auth/sessionToken";
import { NextResponse, type NextRequest } from "next/server";

function remoteConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && key);
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/api/db/health" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/session" ||
    pathname.startsWith("/api/weather") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg"
  );
}

export async function middleware(request: NextRequest) {
  if (!remoteConfigured()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await decodeSession(token, sessionSecret()) : null;
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const redirect = request.nextUrl.clone();
  redirect.pathname = "/login";
  if (pathname !== "/") redirect.searchParams.set("next", pathname);
  return NextResponse.redirect(redirect);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
