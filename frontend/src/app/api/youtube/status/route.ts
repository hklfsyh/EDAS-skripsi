import { NextResponse } from "next/server";
import {
  refreshYouTubeToken,
  YOUTUBE_ACCESS_COOKIE,
  YOUTUBE_EXPIRES_COOKIE,
  YOUTUBE_REFRESH_COOKIE,
} from "@/lib/youtube";

function readCookie(cookieHeader: string, name: string): string | null {
  const pair = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!pair) {
    return null;
  }

  return pair.slice(name.length + 1);
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const accessToken = readCookie(cookieHeader, YOUTUBE_ACCESS_COOKIE);
  const refreshToken = readCookie(cookieHeader, YOUTUBE_REFRESH_COOKIE);
  const expiresAtRaw = readCookie(cookieHeader, YOUTUBE_EXPIRES_COOKIE);
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;

  if (accessToken && expiresAt > Date.now()) {
    return NextResponse.json({ connected: true });
  }

  if (!refreshToken) {
    return NextResponse.json({ connected: false });
  }

  try {
    const refreshed = await refreshYouTubeToken(refreshToken);
    const refreshedExpiresAt = Date.now() + refreshed.expires_in * 1000;

    const response = NextResponse.json({ connected: true });
    response.cookies.set(YOUTUBE_ACCESS_COOKIE, refreshed.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: refreshed.expires_in,
    });

    response.cookies.set(YOUTUBE_EXPIRES_COOKIE, String(refreshedExpiresAt), {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: refreshed.expires_in,
    });

    if (refreshed.refresh_token) {
      response.cookies.set(YOUTUBE_REFRESH_COOKIE, refreshed.refresh_token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch {
    return NextResponse.json({ connected: false });
  }
}
