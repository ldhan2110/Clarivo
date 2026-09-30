import { NextResponse, type NextRequest } from "next/server";

/** Must match SESSION_COOKIE in backend/src/auth/auth.constants.ts. */
const SESSION_COOKIE = "clv_at";

export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url, 307);
}

export const config = {
  /**
   * Everything except the login page itself, Next's internals and static
   * assets. Matching /login here would redirect it to itself forever.
   */
  matcher: [
    "/((?!login|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml)$).*)",
  ],
};
