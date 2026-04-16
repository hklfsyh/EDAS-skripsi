export const YOUTUBE_ACCESS_COOKIE = "youtube_access_token";
export const YOUTUBE_REFRESH_COOKIE = "youtube_refresh_token";
export const YOUTUBE_EXPIRES_COOKIE = "youtube_token_expires_at";
export const YOUTUBE_STATE_COOKIE = "youtube_oauth_state";

export type YouTubeTokenResponse = {
  access_token: string;
  token_type: "Bearer";
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

export function getYouTubeConfig() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "YouTube environment variables belum lengkap. Isi YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, dan YOUTUBE_REDIRECT_URI.",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export function buildYouTubeAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = getYouTubeConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: "https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.force-ssl",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeYouTubeCode(code: string): Promise<YouTubeTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getYouTubeConfig();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gagal exchange code YouTube: ${errorBody}`);
  }

  return (await response.json()) as YouTubeTokenResponse;
}

export async function refreshYouTubeToken(refreshToken: string): Promise<YouTubeTokenResponse> {
  const { clientId, clientSecret } = getYouTubeConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gagal refresh token YouTube: ${errorBody}`);
  }

  return (await response.json()) as YouTubeTokenResponse;
}
