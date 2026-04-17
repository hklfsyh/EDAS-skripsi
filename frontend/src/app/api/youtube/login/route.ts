import { NextResponse } from "next/server";
import {
  buildYouTubeAuthorizeUrl,
  createYouTubeOAuthState,
  getYouTubeConfig,
  YOUTUBE_STATE_COOKIE,
} from "@/lib/youtube";

export async function GET(request: Request) {
  try {
    const state = createYouTubeOAuthState();
    const authorizeUrl = buildYouTubeAuthorizeUrl(state);
    const debug = new URL(request.url).searchParams.get("debug") === "1";

    if (debug) {
      const { redirectUri } = getYouTubeConfig();
      return NextResponse.json({ authorizeUrl, redirectUri });
    }

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(YOUTUBE_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
