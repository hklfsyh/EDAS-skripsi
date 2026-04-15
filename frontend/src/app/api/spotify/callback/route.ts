import { NextResponse } from "next/server";
import {
  exchangeSpotifyCode,
  SPOTIFY_ACCESS_COOKIE,
  SPOTIFY_EXPIRES_COOKIE,
  SPOTIFY_REFRESH_COOKIE,
  SPOTIFY_STATE_COOKIE,
} from "@/lib/spotify";

function buildResultUrl(status: "success" | "error", reason?: string): URL {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = new URL("/hasil", appUrl);
  url.searchParams.set("spotify", status);
  if (reason) {
    url.searchParams.set("reason", reason);
  }
  return url;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieHeader = request.headers.get("cookie") ?? "";
  const expectedState = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SPOTIFY_STATE_COOKIE}=`))
    ?.split("=")[1];

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(buildResultUrl("error", "oauth_state_invalid"));
  }

  try {
    const token = await exchangeSpotifyCode(code);
    const expiresAt = Date.now() + token.expires_in * 1000;
    const response = NextResponse.redirect(buildResultUrl("success"));

    response.cookies.set(SPOTIFY_ACCESS_COOKIE, token.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: token.expires_in,
    });

    if (token.refresh_token) {
      response.cookies.set(SPOTIFY_REFRESH_COOKIE, token.refresh_token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    response.cookies.set(SPOTIFY_EXPIRES_COOKIE, String(expiresAt), {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: token.expires_in,
    });

    response.cookies.set(SPOTIFY_STATE_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch {
    return NextResponse.redirect(buildResultUrl("error", "token_exchange_failed"));
  }
}
