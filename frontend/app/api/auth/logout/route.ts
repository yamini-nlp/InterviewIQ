import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  const cookieHeader = request.headers.get("cookie") || "";

  if (backendUrl) {
    try {
      const backendRes = await fetch(`${backendUrl}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      });
      const text = await backendRes.text();
      let data: any = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = {};
        }
      }
      const response = NextResponse.json(data, { status: backendRes.status });
      const setCookies = backendRes.headers.getSetCookie ? backendRes.headers.getSetCookie() : [];
      for (const cookie of setCookies) {
        response.headers.append("set-cookie", cookie);
      }
      response.cookies.delete("rr_access_token");
      response.cookies.delete("rr_refresh_token");
      return response;
    } catch {
    }
  }

  const response = NextResponse.json({ message: "Logged out" });
  response.cookies.delete("rr_access_token");
  response.cookies.delete("rr_refresh_token");
  return response;
}