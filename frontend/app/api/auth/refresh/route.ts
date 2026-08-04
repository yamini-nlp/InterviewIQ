import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return NextResponse.json({ detail: "The app isn't configured with an API URL." }, { status: 500 });
  }

  const cookieHeader = request.headers.get("cookie") || "";
  let backendRes: Response;
  try {
    backendRes = await fetch(`${backendUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    });
  } catch {
    return NextResponse.json({ detail: "Couldn't reach the server." }, { status: 502 });
  }

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
  return response;
}