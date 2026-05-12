import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION = "ssdomada_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION)?.value;

  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/reseller/:path*", "/customer/:path*", "/super-admin/:path*"],
};
