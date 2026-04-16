import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { buildYouTubeAuthorizeUrl, YOUTUBE_STATE_COOKIE } from "@/lib/youtube";

export async function GET() {
  try {
    const state = crypto.randomUUID();
    const authorizeUrl = buildYouTubeAuthorizeUrl(state);

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
