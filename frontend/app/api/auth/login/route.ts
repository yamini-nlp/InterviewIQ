import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { detail: "The app isn't configured with an API URL (NEXT_PUBLIC_API_URL). Set it in your deployment environment variables." },
      { status: 500 }
    );
  }

  const body = await request.text();
  let backendRes: Response;
  try {
    backendRes = await fetch(`${backendUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    return NextResponse.json(
      { detail: "Couldn't reach the server. Check your connection and try again." },
      { status: 502 }
    );
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