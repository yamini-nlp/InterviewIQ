import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { detail: "The app isn't configured with an API URL (NEXT_PUBLIC_API_URL). Set it in your deployment environment variables." },
      { status: 500 }
    );
  }

  const cookieHeader = request.headers.get("cookie") || "";
  let backendRes: Response;
  try {
    backendRes = await fetch(`${backendUrl}/api/auth/me`, {
      method: "GET",
      headers: { Cookie: cookieHeader },
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

  return NextResponse.json(data, { status: backendRes.status });
}