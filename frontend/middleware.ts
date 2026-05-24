import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/setup", "/simulation", "/practice", "/dashboard", "/report"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();
  const token = request.cookies.get("rr_access_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/setup/:path*", "/simulation/:path*", "/practice/:path*", "/dashboard/:path*", "/report/:path*"],
};