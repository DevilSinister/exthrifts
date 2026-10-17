import { NextResponse, type NextRequest } from "next/server";

// Fast gate only: sends signed-out visitors to the login page without touching
// the database. The real check (session row, active user, role) runs in the
// admin layout and in every admin action and route handler.
const SESSION_COOKIE = "ext_admin";

export function proxy(request: NextRequest) {
  const { pathname, search, hash } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const login = new URL("/admin/login", request.url);
    if (pathname !== "/admin") login.searchParams.set("next", `${pathname}${search}${hash}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

// /.well-known/assetlinks.json and everything public stay outside this gate.
export const config = { matcher: ["/admin", "/admin/:path*"] };
