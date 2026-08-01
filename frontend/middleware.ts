import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/setup", "/simulation", "/practice", "/dashboard", "/report"];

function setAuthCookies(response: NextResponse, access: string, refresh: string, secure: boolean) {
  response.cookies.set("rr_access_token", access, {
    path: "/",
    maxAge: 900,
    sameSite: "strict",
    secure,
  });
  response.cookies.set("rr_refresh_token", refresh, {
    path: "/",
    maxAge: 604800,
    sameSite: "strict",
    secure,
  });
}

async function tryRefresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string } | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token || !data.refresh_token) return null;
    return { access_token: data.access_token, refresh_token: data.refresh_token };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const accessToken = request.cookies.get("rr_access_token")?.value;
  if (accessToken) return NextResponse.next();

  const refreshToken = request.cookies.get("rr_refresh_token")?.value;
  if (refreshToken) {
    const refreshed = await tryRefresh(refreshToken);
    if (refreshed) {
      const response = NextResponse.next();
      const secure = request.nextUrl.protocol === "https:";
      setAuthCookies(response, refreshed.access_token, refreshed.refresh_token, secure);
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
  matcher: ["/setup/:path*", "/simulation/:path*", "/practice/:path*", "/dashboard/:path*", "/report/:path*"],
};