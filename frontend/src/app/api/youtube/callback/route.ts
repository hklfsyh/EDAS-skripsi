import { NextResponse } from "next/server";
import {
  exchangeYouTubeCode,
  verifyYouTubeOAuthState,
  YOUTUBE_ACCESS_COOKIE,
  YOUTUBE_EXPIRES_COOKIE,
  YOUTUBE_REFRESH_COOKIE,
  YOUTUBE_STATE_COOKIE,
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

function buildResultUrl(status: "success" | "error", reason?: string): URL {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").trim();
  const url = new URL("/hasil", appUrl);
  url.searchParams.set("youtube", status);
  if (reason) {
    url.searchParams.set("yt_reason", reason);
  }
  return url;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieHeader = request.headers.get("cookie") ?? "";
  const expectedState = readCookie(cookieHeader, YOUTUBE_STATE_COOKIE);
  const hasValidSignedState = state ? verifyYouTubeOAuthState(state) : false;
  const hasValidCookieState = !!state && !!expectedState && state === expectedState;

  if (!code || !state || (!hasValidSignedState && !hasValidCookieState)) {
    return NextResponse.redirect(buildResultUrl("error", "oauth_state_invalid"));
  }

  try {
    const token = await exchangeYouTubeCode(code);
    const expiresAt = Date.now() + token.expires_in * 1000;
    const response = NextResponse.redirect(buildResultUrl("success"));

    response.cookies.set(YOUTUBE_ACCESS_COOKIE, token.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: token.expires_in,
    });

    if (token.refresh_token) {
      response.cookies.set(YOUTUBE_REFRESH_COOKIE, token.refresh_token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    response.cookies.set(YOUTUBE_EXPIRES_COOKIE, String(expiresAt), {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: token.expires_in,
    });

    response.cookies.set(YOUTUBE_STATE_COOKIE, "", {
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
