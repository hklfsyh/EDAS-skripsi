import { NextResponse } from "next/server";
import {
  refreshSpotifyToken,
  SPOTIFY_ACCESS_COOKIE,
  SPOTIFY_EXPIRES_COOKIE,
  SPOTIFY_REFRESH_COOKIE,
} from "@/lib/spotify";

type ExportTrack = {
  title: string;
  artist: string;
};

type ExportRequestBody = {
  playlistName: string;
  tracks: ExportTrack[];
};

function readCookie(cookieHeader: string, name: string): string | null {
  return (
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.split("=")[1] ?? null
  );
}

async function getValidAccessToken(request: Request): Promise<{
  accessToken: string;
  setCookies?: Array<{ name: string; value: string; maxAge: number }>;
}> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const accessToken = readCookie(cookieHeader, SPOTIFY_ACCESS_COOKIE);
  const refreshToken = readCookie(cookieHeader, SPOTIFY_REFRESH_COOKIE);
  const expiresAtRaw = readCookie(cookieHeader, SPOTIFY_EXPIRES_COOKIE);
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;

  if (accessToken && expiresAt > Date.now()) {
    return { accessToken };
  }

  if (!refreshToken) {
    throw new Error("not_authenticated");
  }

  const refreshed = await refreshSpotifyToken(refreshToken);
  const nextCookies: Array<{ name: string; value: string; maxAge: number }> = [
    {
      name: SPOTIFY_ACCESS_COOKIE,
      value: refreshed.access_token,
      maxAge: refreshed.expires_in,
    },
    {
      name: SPOTIFY_EXPIRES_COOKIE,
      value: String(Date.now() + refreshed.expires_in * 1000),
      maxAge: refreshed.expires_in,
    },
  ];

  if (refreshed.refresh_token) {
    nextCookies.push({
      name: SPOTIFY_REFRESH_COOKIE,
      value: refreshed.refresh_token,
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return {
    accessToken: refreshed.access_token,
    setCookies: nextCookies,
  };
}

async function spotifyGetMe(accessToken: string): Promise<{ id: string }> {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("spotify_me_failed");
  }

  return (await response.json()) as { id: string };
}

async function spotifyCreatePlaylist(userId: string, playlistName: string, accessToken: string): Promise<{ id: string; external_urls?: { spotify?: string } }> {
  const response = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: playlistName,
      description: "Eksperimen export playlist dari hasil EDAS dummy.",
      public: false,
    }),
  });

  if (!response.ok) {
    throw new Error("spotify_create_playlist_failed");
  }

  return (await response.json()) as { id: string; external_urls?: { spotify?: string } };
}

async function spotifySearchTrackUri(track: ExportTrack, accessToken: string): Promise<string | null> {
  const query = `track:${track.title} artist:${track.artist}`;
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "1",
  });

  const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    tracks?: { items?: Array<{ uri: string }> };
  };

  const uri = payload.tracks?.items?.[0]?.uri;
  return uri ?? null;
}

async function spotifyAddTracks(playlistId: string, uris: string[], accessToken: string): Promise<void> {
  for (let index = 0; index < uris.length; index += 100) {
    const chunk = uris.slice(index, index + 100);
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: chunk }),
    });

    if (!response.ok) {
      throw new Error("spotify_add_tracks_failed");
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExportRequestBody;
    if (!body.playlistName || !Array.isArray(body.tracks) || body.tracks.length === 0) {
      return NextResponse.json({ error: "Payload export tidak valid." }, { status: 400 });
    }

    const { accessToken, setCookies } = await getValidAccessToken(request);
    const me = await spotifyGetMe(accessToken);
    const playlist = await spotifyCreatePlaylist(me.id, body.playlistName, accessToken);

    const foundUris: string[] = [];
    const missingTracks: ExportTrack[] = [];

    for (const track of body.tracks) {
      const uri = await spotifySearchTrackUri(track, accessToken);
      if (uri) {
        foundUris.push(uri);
      } else {
        missingTracks.push(track);
      }
    }

    if (foundUris.length > 0) {
      await spotifyAddTracks(playlist.id, foundUris, accessToken);
    }

    const response = NextResponse.json({
      ok: true,
      playlistId: playlist.id,
      playlistUrl: playlist.external_urls?.spotify ?? null,
      totalRequested: body.tracks.length,
      totalAdded: foundUris.length,
      totalMissing: missingTracks.length,
      missingTracks,
    });

    if (setCookies) {
      for (const cookie of setCookies) {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          sameSite: "lax",
          secure: false,
          path: "/",
          maxAge: cookie.maxAge,
        });
      }
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message === "not_authenticated") {
      return NextResponse.json({ error: "Spotify belum terhubung." }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
