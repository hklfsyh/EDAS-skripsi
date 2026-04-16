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

type AddTrackFailure = {
  uri: string;
  status: number;
  detail: string;
};

const MAX_EXPORT_TRACKS = 50;
const SEARCH_CONCURRENCY = 5;

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

async function getResponseTextSafe(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
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

async function spotifyCreatePlaylist(playlistName: string, accessToken: string): Promise<{ id: string; external_urls?: { spotify?: string } }> {
  const response = await fetch("https://api.spotify.com/v1/me/playlists", {
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
    const detail = await getResponseTextSafe(response);
    throw new Error(`spotify_create_playlist_failed:${response.status}:${detail}`);
  }

  return (await response.json()) as { id: string; external_urls?: { spotify?: string } };
}

async function spotifySearchTrackUri(track: ExportTrack, accessToken: string): Promise<string | null> {
  const queries = [
    `track:"${track.title}" artist:"${track.artist}"`,
    `${track.title} ${track.artist}`,
    `track:"${track.title}"`,
  ];

  for (const query of queries) {
    const params = new URLSearchParams({
      q: query,
      type: "track",
      limit: "1",
    });

    const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as {
      tracks?: { items?: Array<{ uri: string }> };
    };

    const uri = payload.tracks?.items?.[0]?.uri;
    if (uri) {
      return uri;
    }
  }

  return null;
}

async function spotifyAddTracks(
  playlistId: string,
  uris: string[],
  accessToken: string,
): Promise<{ addedUris: string[]; failedUris: AddTrackFailure[] }> {
  const addedUris: string[] = [];
  const failedUris: AddTrackFailure[] = [];

  for (let index = 0; index < uris.length; index += 100) {
    const chunk = uris.slice(index, index + 100);
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: chunk }),
    });

    if (!response.ok) {
      if (response.status !== 403 || chunk.length === 1) {
        const detail = await getResponseTextSafe(response);
        throw new Error(`spotify_add_tracks_failed:${response.status}:${detail}`);
      }

      for (const uri of chunk) {
        const singleResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: [uri] }),
        });

        if (singleResponse.ok) {
          addedUris.push(uri);
        } else {
          const singleDetail = await getResponseTextSafe(singleResponse);
          failedUris.push({
            uri,
            status: singleResponse.status,
            detail: singleDetail,
          });
        }
      }

      continue;
    }

    addedUris.push(...chunk);
  }

  return { addedUris, failedUris };
}

async function resolveTrackUris(
  tracks: ExportTrack[],
  accessToken: string,
): Promise<{ foundUris: string[]; missingTracks: ExportTrack[] }> {
  const foundUris: string[] = [];
  const missingTracks: ExportTrack[] = [];

  for (let index = 0; index < tracks.length; index += SEARCH_CONCURRENCY) {
    const chunk = tracks.slice(index, index + SEARCH_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (track) => {
        const uri = await spotifySearchTrackUri(track, accessToken);
        return { track, uri };
      }),
    );

    for (const item of chunkResults) {
      if (item.uri) {
        foundUris.push(item.uri);
      } else {
        missingTracks.push(item.track);
      }
    }
  }

  return { foundUris, missingTracks };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExportRequestBody;
    if (!body.playlistName || !Array.isArray(body.tracks) || body.tracks.length === 0) {
      return NextResponse.json({ error: "Payload export tidak valid." }, { status: 400 });
    }

    const sanitizedTracks = body.tracks
      .filter((track) => track?.title?.trim() && track?.artist?.trim())
      .slice(0, MAX_EXPORT_TRACKS)
      .map((track) => ({
        title: track.title.trim(),
        artist: track.artist.trim(),
      }));

    if (sanitizedTracks.length === 0) {
      return NextResponse.json({ error: "Daftar lagu kosong setelah validasi." }, { status: 400 });
    }

    const { accessToken, setCookies } = await getValidAccessToken(request);
    const playlist = await spotifyCreatePlaylist(body.playlistName, accessToken);

    const { foundUris, missingTracks } = await resolveTrackUris(sanitizedTracks, accessToken);

    const { addedUris, failedUris } =
      foundUris.length > 0
        ? await spotifyAddTracks(playlist.id, foundUris, accessToken)
        : { addedUris: [], failedUris: [] as AddTrackFailure[] };

    if (foundUris.length > 0 && addedUris.length === 0 && failedUris.length > 0) {
      const sample = failedUris.slice(0, 3);
      return NextResponse.json(
        {
          error: "spotify_add_tracks_all_failed",
          hint: "Playlist berhasil dibuat, tapi Spotify menolak penambahan semua lagu. Coba reconnect Spotify agar token + scope segar, lalu ulangi export.",
          totalResolvedUris: foundUris.length,
          sampleFailures: sample,
        },
        { status: 403 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      playlistId: playlist.id,
      playlistUrl: playlist.external_urls?.spotify ?? null,
      totalRequested: sanitizedTracks.length,
      totalAdded: addedUris.length,
      totalMissing: missingTracks.length,
      missingTracks,
      totalFailedToAdd: failedUris.length,
      failedToAddSample: failedUris.slice(0, 3),
      cappedByServer: body.tracks.length > MAX_EXPORT_TRACKS,
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

    const spotifyStatusMatch = /spotify_[^:]+_failed:(\d+):/.exec(message);
    if (spotifyStatusMatch) {
      const status = Number(spotifyStatusMatch[1]);
      const isForbidden = status === 403;

      return NextResponse.json(
        {
          error: message,
          hint: isForbidden
            ? "Spotify menolak aksi playlist (403). Pastikan akun ada di Users and access, lalu remove access app di Spotify Account dan connect ulang agar scope playlist terpasang ulang."
            : undefined,
        },
        { status: Number.isFinite(status) ? status : 500 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
