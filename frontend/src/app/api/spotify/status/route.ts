import { NextResponse } from "next/server";
import {
  hasRequiredSpotifyScopes,
  normalizeSpotifyScopeText,
  parseSpotifyScopes,
  refreshSpotifyToken,
  SPOTIFY_ACCESS_COOKIE,
  SPOTIFY_EXPIRES_COOKIE,
  SPOTIFY_REFRESH_COOKIE,
  SPOTIFY_SCOPE_COOKIE,
} from "@/lib/spotify";

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
  const accessToken = readCookie(cookieHeader, SPOTIFY_ACCESS_COOKIE);
  const refreshToken = readCookie(cookieHeader, SPOTIFY_REFRESH_COOKIE);
  const grantedScope = readCookie(cookieHeader, SPOTIFY_SCOPE_COOKIE);
  const expiresAtRaw = readCookie(cookieHeader, SPOTIFY_EXPIRES_COOKIE);
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;

  if (accessToken && expiresAt > Date.now()) {
    return NextResponse.json({
      connected: true,
      scopes: parseSpotifyScopes(grantedScope),
      hasRequiredScopes: hasRequiredSpotifyScopes(grantedScope),
    });
  }

  if (!refreshToken) {
    return NextResponse.json({ connected: false, scopes: [], hasRequiredScopes: false });
  }

  try {
    const refreshed = await refreshSpotifyToken(refreshToken);
    const refreshedExpiresAt = Date.now() + refreshed.expires_in * 1000;
    const refreshedScope = normalizeSpotifyScopeText(refreshed.scope ?? grantedScope ?? "");

    const response = NextResponse.json({
      connected: true,
      scopes: parseSpotifyScopes(refreshedScope),
      hasRequiredScopes: hasRequiredSpotifyScopes(refreshedScope),
    });
    response.cookies.set(SPOTIFY_ACCESS_COOKIE, refreshed.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: refreshed.expires_in,
    });

    response.cookies.set(SPOTIFY_EXPIRES_COOKIE, String(refreshedExpiresAt), {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: refreshed.expires_in,
    });

    response.cookies.set(SPOTIFY_SCOPE_COOKIE, refreshedScope, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: refreshed.expires_in,
    });

    if (refreshed.refresh_token) {
      response.cookies.set(SPOTIFY_REFRESH_COOKIE, refreshed.refresh_token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch {
    return NextResponse.json({ connected: false, scopes: [], hasRequiredScopes: false });
  }
}
