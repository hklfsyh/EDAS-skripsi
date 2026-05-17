export type YouTubeTokenResponse = {
  access_token: string;
  token_type: "Bearer";
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

function getYouTubeConfig() {
  const clientId = (process.env.YOUTUBE_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.YOUTUBE_CLIENT_SECRET ?? "").trim();
  const redirectUri = (process.env.YOUTUBE_REDIRECT_URI ?? "").trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "YouTube environment variables belum lengkap. Isi YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, dan YOUTUBE_REDIRECT_URI.",
    );
  }

  try {
    new URL(redirectUri);
  } catch {
    throw new Error("YOUTUBE_REDIRECT_URI tidak valid. Pastikan format URL lengkap dan sesuai callback route.");
  }

  return { clientId, clientSecret, redirectUri };
}

async function refreshYouTubeToken(refreshToken: string): Promise<YouTubeTokenResponse> {
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

// === PROJECT ACCOUNT (server-side, kalskripdas@gmail.com) ===
// Token dari environment — tanpa cookie OAuth user.

function getYouTubeProjectRefreshToken(): string {
  const token = (process.env.YOUTUBE_PROJECT_REFRESH_TOKEN ?? "").trim();
  if (!token) {
    throw new Error("YOUTUBE_PROJECT_REFRESH_TOKEN belum diisi di environment.");
  }
  return token;
}

export async function getYouTubeProjectAccessToken(): Promise<string> {
  const refreshToken = getYouTubeProjectRefreshToken();
  const refreshed = await refreshYouTubeToken(refreshToken);
  return refreshed.access_token;
}
