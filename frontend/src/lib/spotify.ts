import { Buffer } from "node:buffer";

export type SpotifyTokenResponse = {
  access_token: string;
  token_type: "Bearer";
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

function getSpotifyConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Spotify environment variables belum lengkap. Isi SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, dan SPOTIFY_REDIRECT_URI.",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function buildBasicAuthorization(clientId: string, clientSecret: string): string {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${credentials}`;
}

async function refreshSpotifyToken(refreshToken: string): Promise<SpotifyTokenResponse> {
  const { clientId, clientSecret } = getSpotifyConfig();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: buildBasicAuthorization(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gagal refresh token Spotify: ${errorBody}`);
  }

  return (await response.json()) as SpotifyTokenResponse;
}

// === PROJECT ACCOUNT (server-side, kalskripdas@gmail.com) ===
// Token dari environment — tanpa cookie OAuth user.

function getSpotifyProjectRefreshToken(): string {
  const token = process.env.SPOTIFY_PROJECT_REFRESH_TOKEN ?? "";
  if (!token) {
    throw new Error("SPOTIFY_PROJECT_REFRESH_TOKEN belum diisi di environment.");
  }
  return token;
}

export async function getSpotifyProjectAccessToken(): Promise<string> {
  const refreshToken = getSpotifyProjectRefreshToken();
  const refreshed = await refreshSpotifyToken(refreshToken);
  return refreshed.access_token;
}
