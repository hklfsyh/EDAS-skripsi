import { Buffer } from "node:buffer";

export const SPOTIFY_ACCESS_COOKIE = "spotify_access_token";
export const SPOTIFY_REFRESH_COOKIE = "spotify_refresh_token";
export const SPOTIFY_EXPIRES_COOKIE = "spotify_token_expires_at";
export const SPOTIFY_STATE_COOKIE = "spotify_oauth_state";
export const SPOTIFY_SCOPE_COOKIE = "spotify_granted_scope";
export const SPOTIFY_REQUIRED_SCOPES = [
  "playlist-modify-private",
  "playlist-modify-public",
];

export type SpotifyTokenResponse = {
  access_token: string;
  token_type: "Bearer";
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

export function getSpotifyConfig() {
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

export function buildSpotifyAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = getSpotifyConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "playlist-modify-private playlist-modify-public user-read-private",
    redirect_uri: redirectUri,
    state,
    show_dialog: "true",
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function buildBasicAuthorization(clientId: string, clientSecret: string): string {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${credentials}`;
}

export async function exchangeSpotifyCode(code: string): Promise<SpotifyTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getSpotifyConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
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
    throw new Error(`Gagal exchange code Spotify: ${errorBody}`);
  }

  return (await response.json()) as SpotifyTokenResponse;
}

export async function refreshSpotifyToken(refreshToken: string): Promise<SpotifyTokenResponse> {
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

export function parseSpotifyScopes(scopeText?: string | null): string[] {
  const rawScope = String(scopeText ?? "").trim();
  if (!rawScope) {
    return [];
  }

  let decodedScope = rawScope;
  try {
    decodedScope = decodeURIComponent(rawScope);
  } catch {
    decodedScope = rawScope;
  }

  return decodedScope
    .split(" ")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function hasRequiredSpotifyScopes(scopeText?: string | null): boolean {
  const granted = new Set(parseSpotifyScopes(scopeText));
  return SPOTIFY_REQUIRED_SCOPES.every((scope) => granted.has(scope));
}
