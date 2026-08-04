import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/setup", "/simulation", "/practice", "/dashboard", "/report", "/settings"];
const AUTH_PAGES = ["/login", "/register"];

function isPrefetchRequest(request: NextRequest): boolean {
  return (
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose") === "prefetch"
  );
}

function safeRedirectTarget(request: NextRequest): string {
  const redirectParam = request.nextUrl.searchParams.get("redirect");
  if (redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")) {
    return redirectParam;
  }
  return "/dashboard";
}

async function tryRefresh(refreshToken: string): Promise<string[] | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `rr_refresh_token=${refreshToken}`,
      },
    });
    if (!res.ok) return null;
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (!setCookies || setCookies.length === 0) return null;
    return setCookies;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (!isProtected && !isAuthPage) return NextResponse.next();

  if (isPrefetchRequest(request)) return NextResponse.next();

  const accessToken = request.cookies.get("rr_access_token")?.value;

  if (isAuthPage) {
    if (accessToken) {
      return NextResponse.redirect(new URL(safeRedirectTarget(request), request.url));
    }
    const refreshTokenForAuthPage = request.cookies.get("rr_refresh_token")?.value;
    if (refreshTokenForAuthPage) {
      const setCookies = await tryRefresh(refreshTokenForAuthPage);
      if (setCookies) {
        const response = NextResponse.redirect(new URL(safeRedirectTarget(request), request.url));
        for (const cookie of setCookies) {
          response.headers.append("set-cookie", cookie);
        }
        return response;
      }
      const cleared = NextResponse.next();
      cleared.cookies.delete("rr_access_token");
      cleared.cookies.delete("rr_refresh_token");
      return cleared;
    }
    return NextResponse.next();
  }

  if (accessToken) return NextResponse.next();

  const refreshToken = request.cookies.get("rr_refresh_token")?.value;
  if (refreshToken) {
    const setCookies = await tryRefresh(refreshToken);
    if (setCookies) {
      const response = NextResponse.next();
      for (const cookie of setCookies) {
        response.headers.append("set-cookie", cookie);
      }
      return response;
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  const redirectResponse = NextResponse.redirect(loginUrl);
  redirectResponse.cookies.delete("rr_access_token");
  redirectResponse.cookies.delete("rr_refresh_token");
  return redirectResponse;
}

export const config = {
  matcher: [
    "/setup/:path*",
    "/simulation/:path*",
    "/practice/:path*",
    "/dashboard/:path*",
    "/report/:path*",
    "/settings/:path*",
    "/login",
    "/register",
  ],
};